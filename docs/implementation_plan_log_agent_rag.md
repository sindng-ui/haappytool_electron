# Log Agent RAG 통합 및 서버 자동 실행 구현 계획서

형님, Log Analysis Agent를 더 똑똑하게 만들기 위해 RAG(Retrieval-Augmented Generation) 기능을 통합하고 서버 관리를 자동화하는 계획을 세웠습니다! 🐧🚀

## User Review Required

> [!IMPORTANT]
> - RAG 서버는 `localhost:8888`에서 동작하며, 에이전트 플러그인이 로드될 때 자동으로 시작됩니다.
> - 사용자가 선택한 RAG 힌트는 AI 분석의 초기 컨텍스트(`initial_hints`)에 포함되어 분석 정밀도를 높이는 데 사용됩니다.
> - 검색 결과는 상위 3개만 표시하여 UI 복잡도를 최소화했습니다.

## Proposed Changes

### 1. Log Analysis Agent UI (`plugins/LogAnalysisAgent`)

#### [MODIFY] [index.tsx](file:///K:/Antigravity_Projects/gitbase/happytool_electron/plugins/LogAnalysisAgent/index.tsx)
- 플러그인 마운트 시 `electronAPI.startRagServer()`를 호출하여 RAG 서버를 자동 실행하는 로직을 추가합니다.
- 서버 상태를 체크하여 UI에 표시할 수 있도록 `isRagOnline` 상태를 관리하거나 `AgentConfigPanel`에 전달합니다.

#### [MODIFY] [AgentConfigPanel.tsx](file:///K:/Antigravity_Projects/gitbase/happytool_electron/plugins/LogAnalysisAgent/components/AgentConfigPanel.tsx)
- `User Hint` 영역 하단에 `Rag Search` 섹션을 추가합니다.
- 검색 입력창, 검색 중 로딩 표시, 검색 결과 리스트(최대 3개), 선택된 항목 표시 UI를 구현합니다.
- 500ms 디바운스를 적용하여 자동 검색 기능을 구현합니다.
- 선택된 RAG 힌트를 `onStart` 콜백을 통해 에이전트 엔진에 전달합니다.

### 2. Analysis Engine (`plugins/LogAnalysisAgent/hooks`)

#### [MODIFY] [useAnalysisAgent.ts](file:///K:/Antigravity_Projects/gitbase/happytool_electron/plugins/LogAnalysisAgent/hooks/useAnalysisAgent.ts)
- `startAnalysis` 함수의 `userHints` 파라미터에 `ragHint` 필드를 추가합니다.
- 추출 단계 이전에 `ragHint`가 존재하면 `allHints` (initial_hints)의 최상단에 `### [RAG REFERENCE HINT]` 섹션으로 추가하여 AI가 참고하게 합니다.

---

## Open Questions

> [!NOTE]
> - RAG 서버가 이미 실행 중인 경우 포트 충돌 없이 'already_running' 상태를 잘 반환하는지 기존 코드를 확인했습니다.
> - 검색 결과 선택 시 취소 기능도 포함할까요? (현재는 다른 항목을 선택하거나 검색어를 지우면 초기화되는 방식으로 생각 중입니다.)

## Verification Plan

### Automated Tests
- (TBD) 필요 시 헬퍼 함수에 대한 유닛 테스트 추가

### Manual Verification
1. Log Agent 탭을 열고 잠시 후 RAG 서버가 온라인 상태로 변하는지 확인합니다.
2. `Target Context` 섹션의 RAG 검색창에 "ANR" 또는 "Crash" 관련 키워드를 입력합니다.
3. 검색 결과 3개가 나오는지 확인하고, 하나를 클릭하여 선택합니다.
4. 'Execute Analysis'를 클릭합니다.
5. 'LLM Communication' 탭에서 첫 번째 요청의 `initial_hints`에 선택한 RAG 내용이 포함되어 있는지 확인합니다.
