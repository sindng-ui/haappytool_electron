# Heavy Hitters 하이라이트 & 딤(Dim) 기능 구현 계획 🚀🔦

형님! 검색창에 자동으로 글자가 찍히는 게 오히려 번거로우셨군요! 말씀하신 대로 **'카드 클릭 시 해당 함수만 불이 켜지고 나머지는 어둡게'** 만들어주는 기능을 투입하겠습니다. 토글 기능까지 넣어서 아주 직관적으로 바꿔볼게요!

## Proposed Changes

### [Speedscope Plugin]

#### [MODIFY] [usePerfDashboardState.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/usePerfDashboardState.ts)
- `highlightName: string | null` 상태를 추가합니다. (어떤 함수를 강조할지 저장)

#### [MODIFY] [PerfFlameGraphRenderer.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/PerfDashboard/utils/PerfFlameGraphRenderer.ts)
- `DrawOptions`에 `highlightName`을 추가합니다.
- `drawFlameChart` 로직 수정:
  - `highlightName`이 설정되어 있다면, `s.name === highlightName`인 항목만 원래 불투명도를 유지하고 나머지는 `0.05` 정도로 어둡게 처리합니다.

#### [MODIFY] [PerfDashboard.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/PerfDashboard.tsx)
- `PerfHeavyHitters`에 `onSelectFunction` 대신 `highlightName`과 이를 변경하는 함수를 전달합니다.
- `PerfFlameGraph` 호출 시 `highlightName`을 옵션으로 넘겨줍니다.

#### [MODIFY] [PerfHeavyHitters.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/PerfDashboard/PerfHeavyHitters.tsx)
- 현재 선택된 `highlightName`을 받아와서, 클릭된 함수가 이미 선택되어 있다면 해제(null), 아니면 선택하는 토글 로직을 적용합니다.
- 선택된 카드에 시각적인 강조 효과(보더 등)를 추가하여 어떤 카드가 켜져 있는지 알 수 있게 합니다.

---

## Verification Plan

### Manual Verification
1. 'Heavy Hitters' 카드 중 하나를 클릭. -> **플레임 그래프 전체가 어두워지면서 해당 함수들만 밝게** 표시되는지 확인.
2. 같은 카드를 다시 클릭. -> **어두워진 효과가 사라지고** 전체가 다시 잘 보이는지 확인.
3. 다른 카드를 클릭. -> 이전 강조는 사라지고 **새로 클릭한 함수만 밝게** 표시되는지 확인.
4. 검색창에 글자가 더 이상 자동으로 입력되지 않는지 확인.

---

## [Proceed]
[형님, 이 핀조명(Spotlight) 효과 바로 장착할까요? 클릭 한 번으로 주인공만 찾아드리겠습니다!]
