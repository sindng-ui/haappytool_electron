# Speedscope 레이아웃 고정 및 하단 UI 보호 계획 🛠️

형님! Flamegraph의 Depth가 깊어질 때(Lane이 많아질 때) 하단 미니맵과 세그먼트 상세 정보창이 밀려나서 안 보이는 문제를 분석했습니다. 이는 Flex 레이아웃에서 중간 영역이 자식 콘텐츠의 크기에 따라 무한정 늘어나는 것을 방지하는 제약(`min-h-0`)이 부족하고, 영역 구분이 명확하지 않아 발생하는 현상입니다.

## 문제 원인 분석
- **Flex 아이템의 수축 거부**: `PerfChartLayout`이 `flex-1`임에도 불구하고, 내부의 거대한 Canvas나 Scroll 영역 때문에 부모 컨테이너를 뚫고 나가는 현상이 발생할 수 있습니다.
- **레이아웃 계층 구조**: 현재 `PerfChartLayout`, `PerfMinimap`, `PerfSegmentDetail`이 평면적으로 나열되어 있어, 상단 요소가 늘어날 때 하단 요소가 밀려나기 쉽습니다.

## Proposed Changes

### [Speedscope Plugin]

#### [MODIFY] [PerfDashboard.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/PerfDashboard.tsx)
- 오른쪽 메인 뷰 영역(Line 274)의 Flex 레이아웃을 보강합니다.
- `PerfChartLayout`과 `PerfMinimap`을 하나의 `flex-1 min-h-0` 컨테이너로 묶어서, 이 영역이 전체 높이 내에서만 동작하도록 제한합니다.
- `PerfSegmentDetail`을 해당 컨테이너 바깥(아래)에 배치하고 `shrink-0`을 다시 한번 확인하여 항상 하단에 고정되도록 합니다.
- 중간 모든 `flex-1` 적용 지점에 `min-h-0`을 추가하여 브라우저의 기본 `min-content` 동작을 억제합니다.

#### [MODIFY] [PerfChartLayout.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/PerfDashboard/PerfChartLayout.tsx)
- 최상위 div에 `flex-1 min-h-0`이 이미 적용되어 있으므로, 부모의 제약 내에서 `overflow-auto`가 확실히 동작하는지 재점검합니다.

---

## Verification Plan

### Manual Verification
1. Speedscope 플러그인에서 매우 깊은 콜스택을 가진 데이터 로드 (Lane 100개 이상)
2. 세그먼트를 클릭하여 하단 상세 정보창(`PerfSegmentDetail`)이 나타나게 함
3. 화면을 위아래로 조절하거나 플러그인 크기를 변경해도 **미니맵과 상세 정보창이 항상 하단에 고정되어 보이는지** 확인
4. 차트 영역에 스크롤바가 정상적으로 생기고, 차트 내에서만 스크롤이 발생하는지 확인

---

## [Proceed]
[형님, 이 레이아웃 보강 계획대로 진행해도 될까요? 승인해주시면 바로 작업 들어갑니다!]
