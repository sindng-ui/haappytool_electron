# Speedscope Flamemap 마우스 클릭 오프셋 이슈 수정 계획 🛠️

형님! Flamemap에서 클릭 시 엉뚱한(위쪽) 세그먼트가 선택되는 문제를 분석해 보니, 화면에 그리는 로직(`PerfFlameGraphRenderer`)과 클릭을 감지하는 로직(`usePerfFlameInteraction`)의 좌표 계산 방식이 서로 달라서 발생하는 누적 오차 때문이었습니다.

## 문제 원인 분석
- **렌더링 로직 (`PerfFlameGraphRenderer.ts`)**: 
  - Lane 높이: `24px`
  - 세그먼트 높이: `22px`
  - 좌표 계산: `y = s.lane * 24 + 24`
- **상호작용 로직 (`usePerfFlameInteraction.ts`)**: 
  - Lane 높이: `28px` (잘못됨!)
  - 세그먼트 높이: `20px` (잘못됨!)
  - 좌표 계산: `y = s.lane * 28 + 24`

Lane 번호가 커질수록(아래로 내려갈수록) 오차가 커져서, 실제로는 아래쪽 Lane을 클릭해도 로직상으로는 위쪽 Lane 범위에 걸리게 됩니다.

## Proposed Changes

### [Speedscope Plugin]

#### [MODIFY] [usePerfFlameInteraction.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/PerfDashboard/hooks/usePerfFlameInteraction.ts)
- `findSegmentAtMouse` 함수 내의 좌표 계산 상수를 `PerfFlameGraphRenderer`와 동일하게 수정합니다.
  - Lane 높이 계산 배수: `28` -> `24`
  - 세그먼트 높이 범위: `20` -> `22`

---

## Verification Plan

### Automated Tests
- `wsl bash -c "npm test -- usePerfFlameInteraction"` 명령어로 관련 테스트 확인

### Manual Verification
1. Speedscope 플러그인 실행
2. 대량의 데이터를 로드하여 Lane이 많이 생성되도록 함
3. 아래쪽 Lane의 세그먼트를 클릭했을 때 정확히 해당 세그먼트가 선택되는지 확인
4. 마우스 호버(Hover) 효과도 정확한 위치에서 발생하는지 확인

---

## [Proceed]
[동의하시면 수정을 시작하겠습니다!]
