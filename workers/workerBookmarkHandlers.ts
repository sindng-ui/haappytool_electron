// --- Helper: Binary Search ---
function binarySearch(arr: Int32Array, val: number): number {
    let low = 0;
    let high = arr.length - 1;

    while (low <= high) {
        const mid = (low + high) >>> 1;
        const midVal = arr[mid];

        if (midVal === val) {
            return mid;
        } else if (midVal < val) {
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }
    return -1;
}

let originalBookmarks: Set<number> = new Set();
let bookmarkCache: number[] = [];
let bookmarkCacheDirty = true;
let lastFilteredIndicesLength = 0;

export const BookmarkManager = {
    clearAll: () => {
        originalBookmarks.clear();
        BookmarkManager.invalidateCache();
    },
    invalidateCache: () => {
        bookmarkCacheDirty = true;
    },
    getVisualBookmarks: (filteredIndices: Int32Array | null): number[] => {
        if (!filteredIndices) return [];

        // ✅ Check if cache is still valid
        if (!bookmarkCacheDirty && filteredIndices.length === lastFilteredIndicesLength) {
            return bookmarkCache;
        }

        // Rebuild cache
        const visualBookmarks: number[] = [];

        // Optimization: filteredIndices is always sorted.
        // Instead of iterating all N visible lines (can be millions),
        // we iterate K bookmarks (usually small) and binary search them in filteredIndices.
        // complexity: O(K * log N) where K << N usually.
        originalBookmarks.forEach(originalIdx => {
            const vIdx = binarySearch(filteredIndices, originalIdx);
            if (vIdx !== -1) {
                visualBookmarks.push(vIdx);
            }
        });

        // ✅ Update cache
        bookmarkCache = visualBookmarks;
        bookmarkCacheDirty = false;
        lastFilteredIndicesLength = filteredIndices.length;

        return visualBookmarks;
    },
    toggleBookmark: (
        visualIndex: number,
        filteredIndices: Int32Array | null,
        respond: (response: any) => void
    ) => {
        if (!filteredIndices) {
            console.warn('[Worker] Toggle Bookmark: No filtered indices available');
            return;
        }
        if (visualIndex < 0 || visualIndex >= filteredIndices.length) {
            console.warn(`[Worker] Toggle Bookmark: Index out of bounds (visual=${visualIndex}, max=${filteredIndices.length})`);
            return;
        }

        const originalIndex = filteredIndices[visualIndex];
        console.log(`[Worker] Toggling Bookmark: Visual=${visualIndex} -> Original=${originalIndex}`);

        if (originalBookmarks.has(originalIndex)) {
            originalBookmarks.delete(originalIndex);
            console.log(`[Worker] Bookmark REMOVED (Total: ${originalBookmarks.size})`);
        } else {
            originalBookmarks.add(originalIndex);
            console.log(`[Worker] Bookmark ADDED (Total: ${originalBookmarks.size})`);
        }

        BookmarkManager.invalidateCache();
        const vBookmarks = BookmarkManager.getVisualBookmarks(filteredIndices);
        console.log(`[Worker] Sending Updated Visual Bookmarks: count=${vBookmarks.length}`);

        respond({ type: 'BOOKMARKS_UPDATED', payload: { visualBookmarks: vBookmarks }, requestId: '' });
    },
    clearBookmarks: (respond: (response: any) => void) => {
        BookmarkManager.clearAll();
        respond({ type: 'BOOKMARKS_UPDATED', payload: { visualBookmarks: [] }, requestId: '' });
    }
};
