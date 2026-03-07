# [Split Analysis UX 보완] 'Processing log..' 메시지 제거 및 애니메이션 최적화

분석 작업(`Analyze diff`, `Spam Analyzer`, `Perf Dashboard`) 실행 시 로그 뷰어가 깜빡이며 'Processing log..' 로딩 화면이 표시되는 현상을 해결합니다.

## Proposed Changes

### Analyze Diff Toggle Functionality

#### [MODIFY] [TopBar.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/TopBar.tsx)
- `TopBarProps`에 `isSplitAnalyzerOpen` 프롭을 추가합니다.
- `Analyze Diff` 버튼의 `disabled={isSplitAnalyzing}`을 제거하여 분석 중에도 클릭 가능하게 합니다 (취소/닫기 용도).
- 버튼의 배경색이나 텍스트를 현재 상태(`isSplitAnalyzerOpen`, `isSplitAnalyzing`)에 따라 동적으로 변경합니다.
  - 분석 중: "Analyzing..." (Pulse 효과)
  - 결과 노출 중: "Close Analysis" (또는 색상 반전)
  - 기본: "Analyze Diff"

#### [MODIFY] [LogSession.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogSession.tsx)
- `TopBar`에 `isSplitAnalyzerOpen` (`!!splitAnalysisResults || isSplitAnalyzing`) 프롭을 전달합니다.
- `onSplitAnalyze` 핸들러에서 이미 분석 중이거나 결과가 있다면 `handleCloseSplitAnalysis`를 호출하고, 아니면 `handleSplitAnalysis`를 호출하도록 토글 로직을 구현합니다.

## Verification Plan

### Automated Tests
- `npm run test`

### Manual Verification
1. `Analyze Diff` 버튼을 눌러 분석을 시작합니다.
2. 분석 도중(Analyzing... 표시 시) 다시 버튼을 눌러 분석이 중단되고 패널이 닫히는지 확인합니다.
3. 분석이 완료되어 리포트가 뜬 상태에서 다시 버튼을 눌러 패널이 닫히는지 확인합니다.
4. 패널이 닫힌 상태에서 다시 버튼을 누르면 분석이 정상적으로 재시작되는지 확인합니다.
