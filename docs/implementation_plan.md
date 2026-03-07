# 분석 리포트 UI 고도화 및 렌더링 이슈 수정 🐧🎨🚀✨

형님! 분석 리포트의 라인 번호를 더 직관적으로(로그 본문 내 번호로) 바꾸고, 스플릿 뷰의 렌더링 이슈를 해결하겠습니다! 🐧🛠️✨

## Proposed Changes

### [Backend/Worker] Metadata Extraction & Data Piping 🐧🛠️⚡
분석 시 로그 본문 내의 라인 번호(예: `(350)`)를 추출하여 UI까지 전달합니다.

#### [MODIFY] [perfAnalysis.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/utils/perfAnalysis.ts)
- `extractSourceMetadata` 함수에서 정규표현식을 사용하여 `FunctionName(350)` 형태에서 `350`을 추출하는 로직을 추가합니다. (이미 완료 🐧🎯)

#### [MODIFY] [workerAnalysisHandlers.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/workers/workerAnalysisHandlers.ts)
- `extractAllMetadata` 및 `extractAnalysisMetrics`에서 추출된 `codeLineNum`을 `LogMetadata`에 담아 전달합니다.

#### [MODIFY] [SplitAnalysisUtils.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/workers/SplitAnalysisUtils.ts)
- `LogMetadata`에서 `codeLineNum`을 받아 `AggregateMetrics`에 저장하도록 수정합니다. (현재/이전 라인 모두 저장)

#### [MODIFY] [SplitAnalysis.worker.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/workers/SplitAnalysis.worker.ts)
- 최종 결과 객체(`SplitAnalysisResult`)에 `leftCodeLineNum`, `rightCodeLineNum` 등의 필드를 추가하여 UI로 넘깁니다.

---

### [Frontend] UI Rendering & Fixes 🐧🎨🚀
리포트 카드에 내부 라인 번호를 표시하고, 렌더링 누락 문제를 해결합니다.

#### [MODIFY] [SplitAnalyzerPanel.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/SplitAnalyzerPanel.tsx)
- Regression 카드 상단에 파일 라인 번호 대신 `codeLineNum`을 우선적으로 표시합니다.

#### [MODIFY] [HyperLogRenderer.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/HyperLogRenderer.tsx)
- 왼쪽 스플릿에서 시간/레벨 정보가 누락되는 현상을 분석하고, 렌더링 시 텍스트가 잘리거나 누락되지 않도록 수정합니다. (X offset 및 문자열 디코딩 로직 점검)

## Verification Plan

### Automated Tests
- 로그 파싱 Regex 테스트 (Unit Test)

### Manual Verification
- `test_startup.log`와 `test_startup_2.log`를 열고 `Analyze Diff`를 실행합니다.
- 리포트 카드의 라인 번호가 `SmartThingsApp.cs:350` 처럼 로그 내부 번호로 나오는지 확인합니다.
- 왼쪽 스플릿 뷰에서도 시간과 로그 레벨이 정상적으로 표시되는지 확인합니다. 🐧✨
