import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBlockTest } from '../components/BlockTest/hooks/useBlockTest';
import { SPECIAL_BLOCK_IDS } from '../components/BlockTest/constants';

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
    io: () => ({
        on: vi.fn(),
        off: vi.fn(),
        emit: vi.fn(),
        disconnect: vi.fn()
    })
}));

describe('useBlockTest - Touch Block & Special Blocks Auto-merge Guard', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('should automatically merge touch block and new special blocks when localStorage has legacy block data', () => {
        // Simulate legacy localStorage data without special_touch
        const legacyBlocks = [
            { id: 'connect_block', name: 'Connect', type: 'predefined', commands: [] },
            { id: 'special_sleep', name: 'Sleep', type: 'special', commands: [] }
        ];
        localStorage.setItem('happytool_blocks', JSON.stringify(legacyBlocks));

        const { result } = renderHook(() => useBlockTest(false));

        const touchBlock = result.current.blocks.find(b => b.id === SPECIAL_BLOCK_IDS.TOUCH);
        expect(touchBlock).toBeDefined();
        expect(touchBlock?.name).toBe('Touch');
        expect(touchBlock?.type).toBe('special');
    });

    it('should load default predefined and special blocks if localStorage is empty', () => {
        const { result } = renderHook(() => useBlockTest(false));

        const touchBlock = result.current.blocks.find(b => b.id === SPECIAL_BLOCK_IDS.TOUCH);
        expect(touchBlock).toBeDefined();
        expect(touchBlock?.id).toBe('special_touch');
    });
});
