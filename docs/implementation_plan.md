# [분석 요약 고도화] 구간 표시 및 점프 기능 도입

## Proposed Changes

### Data Model Enhancement

#### [MODIFY] [SplitAnalysisUtils.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/workers/SplitAnalysisUtils.ts)
- `AggregateMetrics` 인터페이스에 `lineNum: number` 필드 추가.
- `computeMetricsFromMetadata`에서 패턴별 첫 번째 라인 번호를 저장하도록 수정.

#### [MODIFY] [SplitAnalysis.worker.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/workers/SplitAnalysis.worker.ts) & [useSplitAnalysis.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/hooks/useSplitAnalysis.ts)
- `SplitAnalysisResult` 인터페이스에 `leftLineNum`, `rightLineNum` 필드 추가.
- 비교 로직에서 각 사이드의 라인 번호를 결과에 포함.

### UI Enhancement

#### [MODIFY] [SplitAnalyzerPanel.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/SplitAnalyzerPanel.tsx)
- **표시 개수 확장**: `topRegressions` 추출 개수를 3개에서 100개로 변경.
- **구간 형태 표시**: `Top Performance Regressions` 항목의 제목을 `이전 시그니처 ➔ 현재 시그니처` 형태로 표시.
- **로그 점프 기능**: 요약 항목 클릭 시 `onJumpToLine`을 호출하여 좌/우측 로그 뷰어의 해당 라인으로 이동.

## Verification Plan

### Manual Verification
- 요약 탭에서 'Top Regressions' 항목들이 `A ➔ B` 형태로 잘 나오는지 확인.
- 100개까지 목록이 확장되어 표시되는지 확인.
- 항목 클릭 시 좌/우 로그 뷰어에서 해당 라인이 하이라이트 되며 포커싱되는지 확인 🐧⚡.

## Verification Plan

### Manual Verification
1. `Analyze Diff` 버튼이 `Single|Split` 버튼의 왼쪽에 위치하는지 확인합니다.
2. 분석 시작/완료 시 버튼 텍스트가 바뀌어도 버튼 자체의 크기나 주변 요소들의 위치가 변하지 않는지 확인합니다.
3. 시각적으로 레이아웃이 안정적이고 "느낌이 사는지" 확인합니다. 🐧✨
