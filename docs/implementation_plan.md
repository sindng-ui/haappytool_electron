# 로그 분석 에이전트 로직 및 UI 개선 계획

형님! 에이전트가 미션 범위를 벗어나 엉뚱한 곳을 뒤지는 문제와 UI 정보 중복 문제를 깔끔하게 해결해 보겠습니다. 🐧🔍✨

## User Review Required

> [!IMPORTANT]
> **미션 필터링 강화**: 이제 미션을 선택하면 에이전트가 사용하는 모든 도구(검색, 범위 추출 등)가 **필터링된 로그 결과 내에서만** 작동하게 됩니다. 원본 로그 전체를 보고 싶으시면 미션을 '전체 로그 분석'으로 선택하시면 됩니다. 이 방식이 형님이 의도하신 방향이 맞는지 확인 부탁드립니다!

## Proposed Changes

### 1. 로그 분석 코어 로직 개선

#### [MODIFY] [useAnalysisAgent.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/LogAnalysisAgent/hooks/useAnalysisAgent.ts)
- **사전 필터링 도입**: `startAnalysis` 단계에서 `rule`이 있을 경우, `logLines` 자체를 필터링된 결과로 교체합니다.
- 이렇게 하면 에이전트가 `SEARCH_PATTERN` 등을 호출해도 애초에 필터링된 "미션 범위" 내에서만 검색하게 되어 분석의 정확도가 올라갑니다.

#### [MODIFY] [hintExtractor.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/LogAnalysisAgent/services/hintExtractor.ts)
- 전역적으로 재사용 가능한 `filterLogLines` 함수를 추출하여 `useAnalysisAgent`에서 사용할 수 있게 합니다.

### 2. 분석 결과 UI 개선

#### [MODIFY] [AgentThoughtStream.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/LogAnalysisAgent/components/AgentThoughtStream.tsx)
- **IterationCard 헤더 최적화**: 헤더 부분에 중복되던 `thought` 대신, 현재 수행 중인 **'액션 요약'** (예: "Step 2: SEARCH_KEYWORD 수행 중")을 표시합니다.
- 전체 `thought`는 카드를 펼쳤을 때만 정갈하게 보이도록 하여 리스트의 가독성을 높입니다.

---

## Verification Plan

### Automated Tests
- 유닛 테스트를 통해 미션 선택 시 검색 도구가 필터링된 라인 수 내에서만 결과를 반환하는지 확인합니다.

### Manual Verification
1. 특정 미션을 선택하고 분석 시작.
2. 에이전트가 요청하는 `SEARCH_PATTERN` 등의 결과가 실제 Log Extractor의 필터 결과와 일치하는지 확인.
3. 분석 과정 리스트의 헤더가 중복 없이 깔끔하게 표시되는지 확인.

---
형님, 이 계획대로 진행해도 될까요? **Proceed** 혹은 **"고고"** 해주시면 바로 작업 들어갑니다! 🐧🔥🛠️
