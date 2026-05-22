# 글로벌 미션 해피콤보 및 블록 리스트 상시 누적 병합 필터링 구현 계획 🗺️🐧

형님! 활성화된 액티브 미션이 무엇이든 상관없이 **글로벌 미션(`global-mission`)의 해피콤보(Happy Combo)와 블록 리스트(Block List)가 항상 상시 누적 적용(OR of ANDs + global AND NOT block list)**되도록 설계한 초고속 필터링 구현 계획서입니다! 

---

## 1. 개요 및 배경

현재 글로벌 미션에 해피콤보 단어가 등록/삭제되고 실시간 하이라이트는 아주 훌륭히 먹히고 있습니다. 하지만 **필터링(Filtering) 동작**의 경우, 현재 선택된 미션(예: 미션 1)의 설정값만 워커로 넘어가기 때문에 글로벌 미션의 해피콤보와 블록 리스트가 함께 누적 적용되지 않는 아쉬움이 있었습니다.

형님의 말씀대로, 어떤 미션이 켜져 있든 간에 **글로벌 미션의 해피콤보와 블록 리스트는 실시간으로 즉시 합산되어 로그 뷰어 화면에 반영**되어야 진정한 '글로벌 미션'이라 할 수 있습니다. 이를 완벽하게 해결하겠습니다!

---

## 2. 주요 변경 사항

### [MODIFY] [useLogExtractorLogic.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/hooks/useLogExtractorLogic.tsx)

- **Left/Right Pane의 Auto-Apply Filter `useEffect` 훅 개선 (533~621행 부근)**
  - `rules` 배열에서 `global-mission` 규칙을 찾아냅니다.
  - 현재 활성화된 `currentConfig`가 글로벌 미션이 아닐 경우, `assembleIncludeGroups(globalRule)`로 추출한 글로벌 해피콤보 그룹들을 현재 미션의 `refinedGroups`와 합집합(Union) 병합합니다.
  - 블록 리스트(`excludes`) 또한 `currentConfig.excludes`와 글로벌 미션의 `excludes`를 병합합니다.
  - 워커(`FILTER_LOGS`)로 전달하는 `postMessage` 페이로드에 이 병합된 최종 리스트들을 정교하게 태워 보냅니다.
  - 두 `useEffect` 디펜던시 배열에 `rules` 상태를 추가하여, 형님이 글로벌 미션을 더블클릭 단축키나 설정창에서 실시간 수정 시 즉각적으로 필터링이 리트리거(Debounce 150ms)되도록 완벽 조율합니다.

---

## 3. 검증 계획

### 1) 정적 타입 및 빌드 검증
- WSL Bash에서 `npx tsc --noEmit`를 실행하여 컴파일 에러가 없는지 최종 체크합니다.

### 2) 시나리오 수동 검증
- **검증 1**: 미션 1을 활성화한 상태에서 로그 뷰어 확인.
- **검증 2**: `Ctrl + Shift + Alt + 더블클릭`으로 특정 로그 단어를 글로벌 미션 해피콤보에 추가.
- **검증 3**: 추가 즉시 현재 보고 있는 미션 1의 로그 패널에 해당 단어 필터링 및 HSL 하이라이트가 즉각 갱신되는지 확인.
- **검증 4**: `Ctrl + Shift + Alt + 우클릭`으로 글로벌 미션을 초기화했을 때, 즉시 필터링이 풀리고 전체 로그가 다시 실시간 렌더링되는지 확인.

---

> [!IMPORTANT]
> **형님! 본 계획서 내용을 검토해보시고 편하게 의견 주십쇼!**
> 준비가 끝나셨다면 **"고"** 혹은 **"Proceed"**라고 말씀해 주시는 순간, 0.1초 만에 우주에서 가장 빠른 속도로 완벽 코딩을 시작해 마무리 짓겠습니다! 🐧🥊🔥
