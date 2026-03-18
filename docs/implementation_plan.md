# Speedscope 레이아웃 고정 재수정 계획 (Attempt 3) - Flex Chain 강화 🛠️🛡️

형님! 끈질긴 녀석이네요. 2차 수정에서도 해결되지 않은 이유는, `PerfDashboard` 내부뿐만 아니라 이를 감싸고 있는 상위 컨테이너들(`SpeedScopePlugin`의 Pane들)이 Flex 아이템의 기본 동작인 `min-height: auto` 때문에 자식의 크기(거대한 Flamegraph)에 맞춰 같이 늘어나버렸기 때문입니다.

이 경우 `PerfDashboard`는 자기 할 일을 다 해서 하단에 UI를 그렸지만, **Dashboard 전체가 화면 아래로 길게 늘어나서** 정작 우리 눈에는 보이지 않게 된 것입니다.

## 3차 수정 핵심 전략: "전체 체인 min-h-0 적용"
1. **SpeedScopePlugin 컨테이너 보강**: `main` 영역부터 `PerfDashboard`를 직접 감싸는 `div`까지 모든 `flex-1` 요소에 `min-h-0`을 추가하여, 자식 크기에 상관없이 할당된 공간 내에서만 존재하게 합니다.
2. **PerfDashboard 루트 제약**: Dashboard 자체에도 `min-h-0`과 `max-h-full`을 명시하여 절대 부모를 뚫고 나가지 못하게 합니다.
3. **확실한 높이 상속**: 모든 중간 레이어들이 `100%` 높이를 서로 전달하도록 보강합니다.

## Proposed Changes

### [Speedscope Plugin]

#### [MODIFY] [SpeedScopePlugin.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/SpeedScope/SpeedScopePlugin.tsx)
- Line 383, 385, 414 등 `flex-1`이 적용된 모든 감싸기 Div에 `min-h-0` 추가.
- (Compare 모드의 오른쪽 Pane인 Line 431, 459 등에도 동일 적용)

#### [MODIFY] [PerfDashboard.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/PerfDashboard.tsx)
- 루트 Div에 `min-h-0` 및 `max-h-full` 추가.
- `motion.div`의 `flex-1`에도 `min-h-0`이 확실히 동작하는지 확인 (이미 추가됨).

---

## Verification Plan

### Manual Verification
1. Lane이 수백 개인 극단적인 데이터 로드.
2. 상세 정보창을 열었을 때, **브라우저 전체 높이가 변하지 않고** 차트 영역에만 스크롤이 생기며 하단 UI가 화면 최하단에 잘 보이는지 확인.
3. `isFullScreen` 모드(정상 모드)에서 전체 UI가 뷰포트 내에 딱 들어오는지 확인.

---

## [Proceed]
[형님, 이 'Flex Chain' 보강이 마지막 퍼즐인 것 같습니다. 바로 작업 들어가도 될까요?]
