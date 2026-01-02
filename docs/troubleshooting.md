# Troubleshooting Guide

## Tizen Simulation & Scroll Issues

### Issue Description
- **Simulation Logs Not Appearing**: When clicking "Simulate", connections are made but no logs appear in the viewer.
- **Connection Error**: `socket.io` connection fails with CORS or "net::ERR_FAILED" on port 3001.
- **Auto-Scroll Stuck**: The log viewer keeps forcing scroll to the bottom even when the user scrolls up to view history.

### Solution

#### 1. Port Configuration (Zombie Process Avoidance)
Port `3001` is often occupied by zombie processes or previous instances of the log server, causing confusing connection failures or CORS blocks.
**Fix**: Change the default port to **3003** (or another free port).

- **Backend**: `server/index.js` -> `const PORT = 3003;` and `cors: { origin: "*" }`.
- **Frontend**: `components/TizenConnectionModal.tsx` -> `io('http://localhost:3003')`.
- **Electron**: `electron/main.js` -> `mainWindow.loadURL('http://localhost:3003')` (for production/server mode).

#### 2. Log Visibility (Filter Bypass)
Simulated logs (e.g., `[TEST_LOG_...]`) might be filtered out if strict "Include/Exclude" rules are active in the `LogProcessor`.
**Fix**: Force-include test logs in the worker.

- **File**: `workers/LogProcessor.worker.ts`
- **Logic**: In `checkIsMatch`, add a check at the very top:
  ```typescript
  if (isStreamMode && line.includes('[TEST_LOG_')) {
      return true; // Always show simulated logs
  }
  ```

#### 3. Auto-Scroll Conflict
`useLogExtractorLogic` contained a manual `useEffect` that forced `scrollTo(totalHeight)` whenever new logs arrived. This conflicted with `LogViewerPane`'s built-in smart scrolling (`Virtuoso`).
**Fix**: Remove the manual scroll logic to let the UI component handle it locally.

- **File**: `hooks/useLogExtractorLogic.ts` 
- **Action**: Comment out or delete the `useEffect` that watches `leftFilteredCount` and calls `scrollTo`.
- **Mechanism**: `LogViewerPane` uses `followOutput={atBottom ? 'auto' : false}`, which respects user's scroll position automatically.
