# 앱 전체 메모리 누수 점검 (Memory Leak Audit)

형님, 앱을 오래 실행할 때 발생할 수 있는 잠재적인 메모리 누수 현상을 전수 조사했습니다. Electron의 특성상 Main 프로세스(Node.js 환경)와 Renderer 프로세스(React 환경)를 모두 면밀히 점검했습니다.

## 🔍 조사 결과 요약 (Research Results)

1. **이벤트 리스너 (Event Listeners)**: WSL bash 스크립트를 통해 `addEventListener`와 `removeEventListener`의 짝이 맞지 않는 곳을 전수 조사했습니다. Worker 프로세스 1곳을 제외한 모든 UI 컴포넌트에서는 `useEffect`의 cleanup 함수를 통해 이벤트 구독 취소가 완벽하게 이루어지고 있습니다.
2. **배열 크기 무한 증가 (Unbounded Arrays)**: `CpuAnalyzer`, `NetTraffic` 등 지속적으로 데이터가 들어오는 상태(State) 배열을 점검했습니다. 최대 60개(60초 분량)만 남기고 예전 데이터를 버리는 로직(`shift()`)이 잘 적용되어 있어 이 부분은 안전합니다.
3. **Electron Main 프로세스 🚨(누수 발견)**:
   - **ISMS 자동 서명 (NupkgSigner)**: 타임아웃(60초)이 발생하거나 중간에 다운로드 링크 클릭 과정에서 에러가 날 경우, 백그라운드에서 파일 다운로드 완료를 감시하는 `setInterval`이 영원히 삭제되지 않고 (`clearInterval` 누락) 무한루프를 돌며 메모리를 갉아먹는 치명적인 버그를 발견했습니다.
   - **파일 스트리밍 (streamReadFile)**: 대용량 로그 파일을 읽기 위해 생성된 읽기 스트림(`activeStreams`)이, 스트리밍 도중 사용자가 강제로 앱을 새로고침(Ctrl+R)하거나 창을 파괴할 경우 메모리에서 해제되지 않고 붕 뜨게 되는 문제점이 발견되었습니다.

## 🛠 Proposed Changes

### Electron Main Process

#### [MODIFY] [main.cjs](file:///k:/Antigravity_Projects/gitbase/happytool_electron/electron/main.cjs)
1. **AutoSign 타임아웃 메모리 누수 패치**: 
   - `ipcMain.handle('nupkg-auto-sign-so')` 내의 `checkDownload` 인터벌 변수에 대한 확실한 Cleanup 보장.
   - Timeout 이벤트나 Catch(에러) 블록 안에서 반드시 `clearInterval(checkDownload)`이 우선 호출되도록 방어막 전개.
2. **스트림 고아(Orphan Stream) 메모리 해제 로직**:
   - `activeStreams` Map 추적 개선.
   - 만약 `mainWindow`의 웹 컨텐츠가 크래시나거나 강제 새로고침 될 경우(`mainWindow.webContents.on('destroyed')` 또는 `did-navigate` 활용), 아직 끝나지 않은 `activeStreams.values()`를 모두 강제 `destroy()` 하고 Map을 비워버리는 가비지 컬렉션(GC) 로직 투입.
