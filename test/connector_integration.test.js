import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { handleSocketConnection } from '../server/index.cjs';

/**
 * 
 * Live Logging Ecosystem Integration Test (Final Version)
 * covers all aspects of SDB/SSH connection, command substitution, streaming, and control.
 */

describe('Live Logging Ecosystem Integration', () => {
    let socket;
    let mockSpawn;
    let mockSSHConnection;
    let mockSSHStream;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();

        socket = new EventEmitter();
        vi.spyOn(socket, 'emit');

        // 1. SDB Spawn Mock
        mockSpawn = vi.fn().mockImplementation(() => {
            const p = new EventEmitter();
            p.stdout = new EventEmitter();
            p.stderr = new EventEmitter();
            p.stdin = { write: vi.fn(), writable: true };
            p.kill = vi.fn();
            p.pid = 999;
            return p;
        });

        // 2. SSH Mock Objects
        mockSSHStream = new EventEmitter();
        mockSSHStream.write = vi.fn();
        mockSSHStream.stderr = new EventEmitter();
        mockSSHStream.writable = true;

        mockSSHConnection = new EventEmitter();
        mockSSHConnection.connect = vi.fn();
        mockSSHConnection.end = vi.fn();
        mockSSHConnection.shell = vi.fn((cb) => cb(null, mockSSHStream));

        // Initialize Handler
        const MockSSHClient = function () { return mockSSHConnection; };
        handleSocketConnection(socket, {
            spawn: mockSpawn,
            Client: MockSSHClient
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('SDB Pipeline (Verification -> $TAGS -> Stream -> Interactive)', () => {
        it('SDB Full Scenario: Manual Connect with substituted TAGS and interactive stop', async () => {
            // [1] User Connects manually
            socket.emit('connect_sdb', {
                deviceId: 'TV_001',
                command: 'dlogutil $(TAGS) kerneltime',
                tags: ['TAG_X', 'TAG_Y']
            });

            // [2] SDB Verification (echo READY)
            const checker = mockSpawn.mock.results[0].value;
            checker.stdout.emit('data', Buffer.from('READY\n'));
            checker.emit('close', 0);

            // [3] Check real spawn with replaced tags
            expect(mockSpawn).toHaveBeenCalledTimes(2);
            const finalArgs = mockSpawn.mock.calls[1][1];
            expect(finalArgs).toEqual(expect.arrayContaining(['dlogutil', 'TAG_X', 'TAG_Y', 'kerneltime']));
            expect(finalArgs).not.toContain('$(TAGS)');

            const logProcess = mockSpawn.mock.results[1].value;

            // [4] Simulate live log data from device
            logProcess.stdout.emit('data', Buffer.from('TEST_LOG_DATA'));
            expect(socket.emit).toHaveBeenCalledWith('log_data', 'TEST_LOG_DATA');

            // [5] Stop Logging command from FE
            socket.emit('sdb_write', 'pkill dlogutil\n');
            expect(logProcess.stdin.write).toHaveBeenCalledWith('pkill dlogutil\n');
        });

        it('SDB Quick Connect: Uses pre-substituted tags correctly', async () => {
            socket.emit('connect_sdb', {
                deviceId: 'AUTO',
                command: 'dlogutil $(TAGS)',
                tags: ['QUICK_TAG']
            });

            const checker = mockSpawn.mock.results[0].value;
            checker.stdout.emit('data', Buffer.from('READY\n'));
            checker.emit('close', 0);

            const finalArgs = mockSpawn.mock.calls[1][1];
            expect(finalArgs).toEqual(expect.arrayContaining(['dlogutil', 'QUICK_TAG']));
        });

        it('SDB Error: Device not found (Verification fail)', async () => {
            socket.emit('connect_sdb', { deviceId: 'WRONG_ID' });
            const checker = mockSpawn.mock.results[0].value;
            checker.stderr.emit('data', Buffer.from('error: device not found'));
            checker.emit('close', 1);

            expect(socket.emit).toHaveBeenCalledWith('sdb_error', expect.objectContaining({
                message: expect.stringContaining('device not found')
            }));
            expect(mockSpawn).toHaveBeenCalledTimes(1);
        });
    });

    describe('SSH Pipeline (Substitution -> Command -> Stream -> Interactive)', () => {
        it('SSH Full Scenario: Command substitution and data streaming', () => {
            socket.emit('connect_ssh', {
                host: '1.2.3.4',
                command: 'dlogutil $(TAGS) kerneltime',
                tags: ['SSH_1', 'SSH_2']
            });

            mockSSHConnection.emit('ready');
            vi.advanceTimersByTime(600); // Server timeout

            // Verify command substitution
            expect(mockSSHStream.write).toHaveBeenCalledWith('dlogutil SSH_1 SSH_2 kerneltime\n');

            // Verify log data relay
            mockSSHStream.emit('data', Buffer.from('SSH_STREAM_DATA'));
            expect(socket.emit).toHaveBeenCalledWith('log_data', 'SSH_STREAM_DATA');

            // Verify control (Stop Logging)
            socket.emit('ssh_write', 'pkill dlogutil\n');
            expect(mockSSHStream.write).toHaveBeenCalledWith('pkill dlogutil\n');
        });

        it('SSH Authentication: Password request/response flow', () => {
            socket.emit('connect_ssh', { host: 'dev' });
            const finish = vi.fn();

            // Trigger keyboard-interactive
            mockSSHConnection.emit('keyboard-interactive', 'n', 'i', 'l', [{ prompt: 'Pass: ' }], finish);

            // Expect FE notification (skip first call which is connect_ssh)
            const authCall = socket.emit.mock.calls.find(call => call[0] === 'ssh_auth_request');
            expect(authCall).toBeDefined();
            expect(authCall[1].prompt).toBe('Pass: ');

            // Simulate FE user entering password
            socket.emit('ssh_auth_response', 'pass1234');
            expect(finish).toHaveBeenCalledWith(['pass1234']);
        });

        it('SSH Error: Handle Connection Refused', () => {
            socket.emit('connect_ssh', { host: 'dead-dev' });

            const err = new Error('Refused');
            err.code = 'ECONNREFUSED';
            mockSSHConnection.emit('error', err);

            expect(socket.emit).toHaveBeenCalledWith('ssh_error', expect.objectContaining({
                message: expect.stringContaining('Connection Refused')
            }));
        });

        it('Smart Builder: Should NOT have empty filter or trailing semicolon when tags are empty (SSH)', () => {
            // No command provided, No tags provided -> Should use minimal smart default
            socket.emit('connect_ssh', {
                host: '1.2.3.4',
                tags: []
            });

            mockSSHConnection.emit('ready');
            vi.advanceTimersByTime(600);

            // Correct: Should be just dlogutil -v kerneltime (NOT logger-mgr --filter ;)
            expect(mockSSHStream.write).toHaveBeenCalledWith('dlogutil -v kerneltime\n');
        });
    });
});
