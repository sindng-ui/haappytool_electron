import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import util from 'util';

// Mock child_process
const mockSpawn = vi.fn();
vi.mock('child_process', () => ({
    spawn: mockSpawn,
    exec: vi.fn()
}));

// Import code under test
import { handleSocketConnection } from '../server/index.cjs';

describe('Server Socket Connection', () => {
    let socket;
    let spawnProcess;
    let mockStream;
    let mockSSHConnection;

    beforeEach((context) => {
        const testName = context.task.name;

        vi.spyOn(console, 'log').mockImplementation((...args) => {
            process.stdout.write(util.formatWithOptions({ colors: false }, ...args) + '\n');
        });

        console.log(`\n⬇️  [START TEST] "${testName}"`);

        vi.clearAllMocks();

        // Setup Socket Mock
        socket = new EventEmitter();
        vi.spyOn(socket, 'emit');

        // Setup Spawn Process Mock (SDB)
        spawnProcess = new EventEmitter();
        spawnProcess.stdout = new EventEmitter();
        spawnProcess.stderr = new EventEmitter();
        spawnProcess.kill = vi.fn();
        spawnProcess.pid = 1234;
        mockSpawn.mockReturnValue(spawnProcess);

        // Setup SSH Params
        mockSSHConnection = new EventEmitter();
        mockSSHConnection.connect = vi.fn();
        mockSSHConnection.end = vi.fn();

        // Mock Shell
        mockStream = new EventEmitter();
        mockStream.write = vi.fn();
        mockStream.end = vi.fn();
        mockStream.stderr = new EventEmitter();

        mockSSHConnection.shell = vi.fn().mockImplementation((cb) => {
            cb(null, mockStream);
        });

        // Initialize Handler with Injected Dependencies
        handleSocketConnection(socket, {
            spawn: mockSpawn,
            Client: vi.fn(function () {
                return mockSSHConnection;
            })
        });
    });

    afterEach((context) => {
        vi.useRealTimers();
        console.log(`⬆️  [END TEST]   "${context.task.name}"\n`);
    });

    describe('SDB Connection', () => {
        it('should execute default command (dlogutil -v kerneltime) if none provided', () => {
            socket.emit('connect_sdb', { deviceId: 'test-device' });

            expect(mockSpawn).toHaveBeenCalled();
            const [cmd, args] = mockSpawn.mock.calls[0];
            expect(cmd).toBe('sdb');
            expect(args).toEqual(expect.arrayContaining(['dlogutil', '-v', 'kerneltime']));
        });

        it('should execute user provided command (e.g. ls -al)', () => {
            socket.emit('connect_sdb', { deviceId: 'test-device', command: 'ls -al' });

            expect(mockSpawn).toHaveBeenCalled();
            const [cmd, args] = mockSpawn.mock.calls[0];
            expect(args).toEqual(expect.arrayContaining(['ls', '-al']));
        });

        it('should execute complex user provided command (e.g. ps -ef | grep process)', () => {
            socket.emit('connect_sdb', { deviceId: 'test-device', command: 'ps -ef | grep process' });

            expect(mockSpawn).toHaveBeenCalled();
            const [cmd, args] = mockSpawn.mock.calls[0];
            // Start limit is usually index 3
            // args: [ '-s', 'test-device', 'shell', 'ps', '-ef', '|', 'grep', 'process' ]
            expect(args).toEqual(expect.arrayContaining(['ps', '-ef', '|', 'grep', 'process']));
        });

        it('should substitute $(TAGS) with space-joined tags in SDB command', () => {
            socket.emit('connect_sdb', {
                deviceId: 'test-device',
                command: 'dlogutil $(TAGS) kerneltime',
                tags: ['-v', 'threadtime', 'InputManager']
            });

            expect(mockSpawn).toHaveBeenCalled();
            const [cmd, args] = mockSpawn.mock.calls[0];
            // Expectation: 'dlogutil -v threadtime InputManager kerneltime'
            // args: [ '-s', 'test-device', 'shell', 'dlogutil', '-v', 'threadtime', 'InputManager', 'kerneltime' ]
            expect(args).toEqual(expect.arrayContaining(['dlogutil', '-v', 'threadtime', 'InputManager', 'kerneltime']));
        });

        it('should apply tags to DEFAULT SDB command if no command provided', () => {
            // Default SDB command now contains $(TAGS): 'dlogutil -v kerneltime $(TAGS)'
            socket.emit('connect_sdb', {
                deviceId: 'test-device',
                tags: ['AudioPolicy']
            });

            expect(mockSpawn).toHaveBeenCalled();
            const [cmd, args] = mockSpawn.mock.calls[0];
            // Expectation: 'dlogutil -v kerneltime AudioPolicy'
            expect(args).toEqual(expect.arrayContaining(['dlogutil', '-v', 'kerneltime', 'AudioPolicy']));
        });

        it('should emit log_data when process writes to stdout', () => {
            socket.emit('connect_sdb', { deviceId: 'test-device' });

            // Verify startup
            expect(mockSpawn).toHaveBeenCalled();

            // Simulate stdout data
            const testData = 'Sample Log Line';
            spawnProcess.stdout.emit('data', Buffer.from(testData));

            // Server emits 'log_data' for both SDB and SSH
            expect(socket.emit).toHaveBeenCalledWith('log_data', expect.stringContaining(testData));
        });

        it('should emit sdb_error when process encounters error', () => {
            socket.emit('connect_sdb', { deviceId: 'test-device' });

            const errorMsg = 'Command not found';
            spawnProcess.emit('error', new Error(errorMsg));

            // SDB error payload is an object
            expect(socket.emit).toHaveBeenCalledWith('sdb_error', expect.objectContaining({
                message: expect.stringContaining(errorMsg)
            }));
        });

        it('should kill existing process before starting new one', () => {
            // First Connection
            socket.emit('connect_sdb', { deviceId: 'dev1' });
            const firstProcess = spawnProcess;

            // Reset mock logic to return a NEW process instance for the second call
            const secondProcess = new EventEmitter();
            secondProcess.stdout = new EventEmitter();
            secondProcess.stderr = new EventEmitter();
            secondProcess.kill = vi.fn();
            secondProcess.pid = 5678;
            mockSpawn.mockReturnValue(secondProcess);

            // Second Connection
            socket.emit('connect_sdb', { deviceId: 'dev2' });

            // Verify first process was killed
            expect(firstProcess.kill).toHaveBeenCalled();

            // Verify second process was spawned
            expect(mockSpawn).toHaveBeenCalledTimes(2);
        });
    });

    describe('SSH Connection', () => {
        it('should execute default command (dlogutil -v kerneltime) if none provided', () => {
            vi.useFakeTimers();

            socket.emit('connect_ssh', {
                host: '1.2.3.4',
                port: 22,
                username: 'root',
                password: 'password'
            });

            // Simulate ready event manually on our mock instance
            mockSSHConnection.emit('ready');

            // Fast-forward timeout
            vi.advanceTimersByTime(1000);

            expect(mockStream.write).toHaveBeenCalled();
            const sentCmd = mockStream.write.mock.calls[0][0];
            expect(sentCmd).toContain('dlogutil');
            expect(sentCmd).toContain('kerneltime');
        });

        it('should execute user provided command (e.g. tail -f ...)', () => {
            vi.useFakeTimers();

            socket.emit('connect_ssh', {
                host: '1.2.3.4',
                username: 'testuser',
                command: 'tail -f /var/log/messages'
            });

            mockSSHConnection.emit('ready');
            vi.advanceTimersByTime(1000);

            expect(mockStream.write).toHaveBeenCalled();
            const sentCmd = mockStream.write.mock.calls[0][0];
            expect(sentCmd).toContain('tail -f /var/log/messages');
        });

        it('should execute arbitrary user provided command (e.g. top)', () => {
            vi.useFakeTimers();

            socket.emit('connect_ssh', {
                host: '1.2.3.4',
                username: 'testuser',
                command: 'top -n 1'
            });

            mockSSHConnection.emit('ready');
            vi.advanceTimersByTime(1000);

            expect(mockStream.write).toHaveBeenCalled();
            const sentCmd = mockStream.write.mock.calls[0][0];
            expect(sentCmd).toContain('top -n 1');
        });

        it('should substitute $(TAGS) with space-joined tags in SSH command', () => {
            vi.useFakeTimers();

            socket.emit('connect_ssh', {
                host: '1.2.3.4',
                username: 'testuser',
                command: 'logger-mgr --filter $(TAGS); dlogutil -v kerneltime $(TAGS) &',
                tags: ['AudioPolicy', 'AudioFlinger']
            });

            mockSSHConnection.emit('ready');
            vi.advanceTimersByTime(1000);

            expect(mockStream.write).toHaveBeenCalled();
            const sentCmd = mockStream.write.mock.calls[0][0];

            // Should contain substituted string
            expect(sentCmd).toContain('logger-mgr --filter AudioPolicy AudioFlinger');
            expect(sentCmd).toContain('dlogutil -v kerneltime AudioPolicy AudioFlinger');
        });

        it('should apply tags to DEFAULT SSH command if no command provided', () => {
            vi.useFakeTimers();

            // Default SSH Command is now: 'dlogutil -c;logger-mgr --filter $(TAGS); dlogutil -v kerneltime $(TAGS) &'
            socket.emit('connect_ssh', {
                host: '1.2.3.4',
                username: 'testuser',
                tags: ['SystemUI']
            });

            mockSSHConnection.emit('ready');
            vi.advanceTimersByTime(1000);

            expect(mockStream.write).toHaveBeenCalled();
            const sentCmd = mockStream.write.mock.calls[0][0];

            // Verify substitution in the default command
            expect(sentCmd).toContain('logger-mgr --filter SystemUI');
            expect(sentCmd).toContain('dlogutil -v kerneltime SystemUI');
        });

        it('should emit log_data when stream outputs data', () => {
            vi.useFakeTimers();

            socket.emit('connect_ssh', {
                host: '1.2.3.4',
                username: 'testuser'
            });

            mockSSHConnection.emit('ready');
            vi.advanceTimersByTime(1000);

            // Simulate data from shell stream
            const testLog = 'SSH Log Line';
            mockStream.emit('data', Buffer.from(testLog));

            expect(socket.emit).toHaveBeenCalledWith('log_data', expect.stringContaining(testLog));
        });

        it('should emit ssh_error on connection failure', () => {
            socket.emit('connect_ssh', {
                host: '1.2.3.4',
                username: 'testuser'
            });

            const errorMsg = 'Authentication failed';
            mockSSHConnection.emit('error', new Error(errorMsg));

            // SSH error payload is an object
            expect(socket.emit).toHaveBeenCalledWith('ssh_error', expect.objectContaining({
                message: expect.stringContaining(errorMsg)
            }));
        });
    });
});
