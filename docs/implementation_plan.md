# [Split Analysis UX 보완] 'Processing log..' 메시지 제거 및 애니메이션 최적화

분석 작업(`Analyze diff`, `Spam Analyzer`, `Perf Dashboard`) 실행 시 로그 뷰어가 깜빡이며 'Processing log..' 로딩 화면이 표시되는 현상을 해결합니다.

## Proposed Changes

### Individual Log Pane Closing (Split Mode)

#### [MODIFY] [LogViewerToolbar.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/LogViewerToolbar.tsx)
- `LogViewerToolbarProps`에 `onReset` 콜백을 추가합니다.
- 툴바 우측 상단이나 파일명 옆에 로그를 닫을 수 있는 `X` (Close) 버튼을 추가합니다.
- `X` 버튼 클릭 시 `onReset`이 호출되도록 합니다.

#### [MODIFY] [LogViewerPane.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/LogViewerPane.tsx)
- `LogViewerToolbar`에 `onReset` 프롭을 전달합니다.

#### [MODIFY] [LogSession.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogSession.tsx)
- (이미 전달 중) `LogViewerPane`에 `handleLeftReset` 및 `handleRightReset`이 정상적으로 연결되어 있는지 재확인합니다.

## Verification Plan

### Automated Tests
- `npm run test`

### Manual Verification
1. 로그가 두 개 로드된 Split Mode에 진입합니다.
2. 왼쪽 패널의 `X` 버튼을 클릭하여 왼쪽 로그만 닫히는지 확인합니다.
3. 오른쪽 패널의 `X` 버튼을 클릭하여 오른쪽 로그만 닫히는지 확인합니다.
4. 로그를 닫은 후 다시 새로운 로그를 드래그 앤 드롭하거나 열 수 있는지 확인합니다.
5. 로그를 닫을 때 메모리/워커 자원이 정상적으로 해제되는지 확인합니다. (기존 Reset 로직 검증)
