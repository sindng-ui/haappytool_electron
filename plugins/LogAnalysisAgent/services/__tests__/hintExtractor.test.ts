import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractHints } from '../hintExtractor';
import { LogRule } from '../../../../types';

// Mock setTimeout for chunking logic
vi.useFakeTimers();

describe('hintExtractor (Phase 8: UT)', () => {
  const mockRule: LogRule = {
    id: 'test-rule',
    name: 'Test Mission',
    includeGroups: [
      ['FATAL'], ['PANIC'], ['CRASH'],
      ['ERROR'], ['Exception']
    ],
    excludes: [],
    highlights: []
  };

  it('should extract Crash related hints', async () => {
    const logs = [
      'I/ActivityManager: Start activity',
      'F/libc: Fatal signal 11 (SIGSEGV), code 1 (SEGV_MAPERR), fault addr 0x0',
      'E/AndroidRuntime: FATAL EXCEPTION: main'
    ];
    
    const promise = extractHints(logs, mockRule, 'crash');
    vi.runAllTimers();
    const { hints } = await promise;
    
    expect(hints).toContain('SIGSEGV'); // From ANALYSIS_PATTERNS
    expect(hints).toContain('FATAL EXCEPTION'); // From includeGroups (Happy Combo)
    expect(hints).toContain('Fatal signal');
  });

  it('should extract Deadlock related hints', async () => {
    const logs = [
      'W/Watchdog: Potential deadlock in Thread-1',
      'I/System: Thread-1 is blocked on <0x1234a>',
      'I/System: Thread-2 holds <0x1234a>'
    ];
    
    const promise = extractHints(logs, mockRule, 'deadlock');
    vi.runAllTimers();
    const { hints } = await promise;
    
    expect(hints).toContain('deadlock');
    expect(hints).toContain('blocked');
    expect(hints).toContain('holds');
  });

  it('should respect Happy Combo include rules', async () => {
    const logs = [
      'E/Tag: FATAL_ERROR_OCCURRED',
      'I/Tag: Just info'
    ];
    
    const promise = extractHints(logs, mockRule, 'perf');
    vi.runAllTimers();
    const { hints } = await promise;
    
    // 'FATAL' is in includeGroups
    expect(hints).toContain('FATAL_ERROR_OCCURRED');
  });

  it('should handle large logs using chunking', async () => {
    const largeLogs = Array.from({ length: 15000 }, (_, i) => 
      i === 12000 ? 'E/Target: FATAL: ERROR_DETECTED' : `I/Log: line ${i}`
    );
    
    const promise = extractHints(largeLogs, mockRule, 'crash');
    await vi.runAllTimersAsync();
    
    const { hints } = await promise;
    expect(hints).toContain('FATAL: ERROR_DETECTED');
  });

  it('should limit result size to prevent token overflow', async () => {
    const manyMatches = Array.from({ length: 1000 }, () => 'E/MATCH: CRASH_HIT');
    
    const promise = extractHints(manyMatches, mockRule, 'crash');
    vi.runAllTimers();
    const { hints } = await promise;
    
    const lines = hints.split('\n');
    // Result limit is around 500 lines in hintExtractor
    expect(lines.length).toBeLessThanOrEqual(505);
  });
});
