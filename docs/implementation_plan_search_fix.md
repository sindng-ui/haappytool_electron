# 대소문자 무시 검색 버그 수정 계획 🐧🔍⚡

형님! 검색할 때 대소문자 때문에 결과가 다르게 나오는 문제를 확실히 잡겠습니다. `usePerfFlameData`의 필터링 로직과 `checkSegmentMatch`의 비교 방식을 더 견고하게 고치겠습니다!

## Proposed Changes

### 1. [[Log Viewer State Logic]]
#### [MODIFY] [usePerfDashboardState.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/usePerfDashboardState.ts)
- `checkSegmentMatch` 함수 내의 모든 문자열 비교에 선택적 체이닝(`?.`)과 기본값(`?? ''`)을 추가하여 널 참조 오류를 방지하고, 확실하게 소문자로 변환하여 비교하도록 개선합니다.

### 2. [[Flame Data Filtering Optimization]]
#### [MODIFY] [usePerfFlameData.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/usePerfFlameData.ts)
- `activeTags` 필터링 로직에서 `includes` 호출 시 양쪽 모두를 소문자로 변환하여 대소문자 구분 없이 필터링되도록 수정합니다.

## Verification Plan

### Automated Tests
- 검색창에 `native`, `Native`, `NATIVE`를 번갈아 입력하며 차트의 하이라이트가 동일하게 유지되는지 확인합니다.
- 태그 클릭 시에도 대소문자와 상관없이 관련 로그 세그먼트가 정상적으로 필터링되는지 확인합니다.

### Manual Verification
- 형님께서 주신 캡쳐 상황(Native vs native)을 재현하여 두 경우 모두 시원하게 매칭되는지 확인합니다!

---
형님, 이대로 진행할까요? 아래 버튼을 눌러주십쇼! 🐧🔥🚀

<button onclick="alert('Proceeding with the fix!')">Proceed</button>
