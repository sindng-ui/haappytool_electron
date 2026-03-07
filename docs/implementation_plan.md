# [Split Analysis UX 보완] 'Processing log..' 메시지 제거 및 애니메이션 최적화

분석 작업(`Analyze diff`, `Spam Analyzer`, `Perf Dashboard`) 실행 시 로그 뷰어가 깜빡이며 'Processing log..' 로딩 화면이 표시되는 현상을 해결합니다.

## Proposed Changes

### Split Analyzer UX Enhancement

#### [MODIFY] [useSplitAnalysis.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/hooks/useSplitAnalysis.ts)
- `closeAnalysis` 호출 시 실행 중인 워커(`analyzerWorkerRef`)를 즉시 `terminate()` 하도록 수정합니다.
- 워커 종료 후 다음 분석을 위해 즉시 새로운 워커 인스턴스를 생성(`initWorker`)합니다.
- `isCancelledRef`를 도입하여 메타데이터 페칭(`performAnalysis`) 도중 중단되었을 경우 이후 프로세스를 중단합니다.

#### [MODIFY] [workerAnalysisHandlers.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/workers/workerAnalysisHandlers.ts)
- (수정 완료) 분석 중 상태를 `analyzing`으로 변경하여 UI 깜빡임 방지.

#### [MODIFY] [SplitAnalyzerPanel.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/SplitAnalyzerPanel.tsx)
- (수정 완료) 애니메이션 속도 조절 (0.15s) 및 내부 로딩 UI 추가.

#### [MODIFY] [LogSession.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogSession.tsx)
- (수정 완료) 전역 로딩 오버레이 제거 및 애니메이션 래퍼 추가.

## Verification Plan

### Automated Tests
- `npm run test`

### Manual Verification
1. `Analyze Diff` 버튼 클릭 후 즉시 상단 패널의 `X` 버튼을 눌러 닫습니다.
2. 잠시 기다린 후 분석 결과가 멋대로 다시 팝업되지 않는지 확인합니다.
3. 다시 `Analyze Diff`를 눌렀을 때 분석이 정상적으로 재시작되는지 확인합니다.
4. 분석 중 자원 사용량(CPU/Memory)이 패널을 닫는 즉시 감소하는지 확인합니다. (Worker Terminate 확인)
