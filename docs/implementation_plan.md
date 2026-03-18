# Speedscope 레이아웃 고정 재수정 계획 (Attempt 2) 🛠️🚀

형님! 1차 수정에서 적용한 `min-h-0`만으로는 일부 브라우저나 상황에서 Flamegraph의 거대한 콘텐츠 높이를 억제하지 못한 것 같습니다. 이번에는 더 강력하고 명시적인 레이아웃 제약을 적용하겠습니다.

## 2차 수정 핵심 전략
1. **최상위 컨테이너 제약**: `PerfDashboard` 루트 Div에 `overflow-hidden`을 확실히 추가하여 자식이 삐져나오지 못하게 합니다.
2. **motion.div 높이 명시**: `AnimatePresence` 내부의 `motion.div`가 부모의 남은 높이를 확실히 100% 채우도록 `h-full` 또는 `height: 100%`를 강제합니다.
3. **Flex-Basis 활용**: `flex-1` 대신 `flex-[1_1_0%]` (또는 `height: 0`)를 사용하여, 콘텐츠 크기에 관계없이 남은 공간만 차지하도록 바닥부터 다시 계산하게 합니다.
4. **영역 분리 명확화**: 차트 영역을 감싸는 컨테이너에 `absolute inset-0` 등을 활용하여 부모의 크기에 완전히 종속되도록 만듭니다.

## Proposed Changes

### [Speedscope Plugin]

#### [MODIFY] [PerfDashboard.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/PerfDashboard.tsx)
- 루트 container에 `overflow-hidden` 추가.
- `motion.div` (Line 253)에 `h-full` 추가 및 스타일 보강.
- 오른쪽 메인 패널(Line 274)의 배치를 더욱 견고하게 수정.
- `PerfChartLayout`을 감싸는 wrapper에 `flex-1 min-h-0 relative`를 적용하고, `PerfMinimap`과 `PerfSegmentDetail`은 그 아래에 명확히 `shrink-0`으로 배치.

#### [MODIFY] [PerfChartLayout.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/PerfDashboard/PerfChartLayout.tsx)
- 최상위 div의 `flex-1`이 부적절하게 동작할 수 있으므로, 부모에서 크기를 결정하도록 스타일을 정리합니다.

---

## Verification Plan

### Manual Verification
1. 매우 큰 데이터(많은 Lane) 로드 후, 상세 정보창을 열었을 때 **화면 하단에 미니맵과 정보창이 잘려나가지 않고 항상 보이는지** 확인.
2. 창 크기를 줄이었을 때 차트 영역에만 스크롤바가 생기고, 하단 UI는 위치를 유지하는지 확인.
3. `isFullScreen` 모드와 일반 모드 양쪽에서 모두 레이아웃이 깨지지 않는지 확인.

---

## [Proceed]
[형님, 이번에는 확실하게 잡겠습니다! 고고할까요?]
