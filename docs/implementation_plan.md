# [분석 성능 최적화] 메타데이터 전송 부하 감소 및 메인 스레드 프리징 해결
  
대용량 로그(1GB+) 분석 시 수백만 개의 메타데이터 객체를 전송하면서 발생하는 메인 스레드 프리징을 해결하기 위해, 각 워커에서 데이터를 직접 요약(Aggregate)하여 결과만 전송하는 방식으로 구조를 변경합니다.

## Proposed Changes

### Log Worker Optimization

#### [MODIFY] [workerAnalysisHandlers.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/workers/workerAnalysisHandlers.ts)
- `extractAnalysisMetrics` 핸들러 추가: 메타데이터를 추출하면서 즉시 `Metrics`를 계산하여, 수백만 개의 개별 로그 데이터 대신 수천 개의 요약된 시그니처 데이터만 반환합니다.

#### [MODIFY] [types.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/types.ts)
- `GET_ANALYSIS_METRICS`, `ANALYSIS_METRICS_RESULT` 메시지 타입 추가.

### Analysis Logic Optimization

#### [MODIFY] [useSplitAnalysis.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/hooks/useSplitAnalysis.ts)
- `GET_ALL_METADATA` 대신 `GET_ANALYSIS_METRICS`를 호출하도록 변경.
- 전송되는 데이터 크기가 획기적으로 줄어들어 메인 스레드 프리징이 사라집니다.

#### [MODIFY] [SplitAnalysis.worker.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/workers/SplitAnalysis.worker.ts)
- 워커에서 `computeMetrics`를 수행하지 않고, 이미 계산된 `leftMetrics`, `rightMetrics`를 받아 즉시 비교 결과만 산출하도록 최적화합니다.

## Verification Plan

### Manual Verification
1. `Analyze Diff` 버튼이 `Single|Split` 버튼의 왼쪽에 위치하는지 확인합니다.
2. 분석 시작/완료 시 버튼 텍스트가 바뀌어도 버튼 자체의 크기나 주변 요소들의 위치가 변하지 않는지 확인합니다.
3. 시각적으로 레이아웃이 안정적이고 "느낌이 사는지" 확인합니다. 🐧✨
