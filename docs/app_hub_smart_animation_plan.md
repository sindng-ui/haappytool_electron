# Implementation Plan - App Hub "Smart Speed" Interaction (Fast Exit)

형님, 마우스를 뗄 때 답답하셨군요! 🐧💨
원인은 처음 등장할 때 쓰던 '굼뜬 0.5초' 설정이 마우스를 뗄 때도 똑같이 적용되고 있어서 그렇습니다. 이를 해결하기 위해 **'처음 뜰 때만 굼뜨고, 그 이후에는 번개처럼'** 동작하도록 지능형 트랜지션을 적용하겠습니다.

## 📋 변경 사항

### 1. `components/AppLibraryModal.tsx`

- **애니메이션 상태 관리 추가**
  - `AppCard` 내부에 `isEntranceDone` 상태를 추가하여 처음 등장이 완료되었는지 감지합니다.
- **지능형 트랜지션 적용 (Smart Transition)**
  - `visible` 변이의 트랜지션을 다음과 같이 이원화합니다:
    - **등장 시 (`!isEntranceDone`)**: 형님이 좋아하시는 그 굼뜬 0.5초 `tween` 애니메이션 적용.
    - **그 이후 (`isEntranceDone`)**: 마우스 오버 해제 시 즉각 반응하도록 빠릿한 `spring` 애니메이션 적용.
- **마우스 오버/탭**: 지금의 빠릿한 설정을 유지합니다.

## 🛠️ 작업 단계

1. `AppCard` 컴포넌트 내부에 `useState`를 사용한 등장 완료 상태 추가.
2. `motion.button`의 `onAnimationComplete` 이벤트에서 상태 업데이트.
3. `visible` variant의 `transition`을 상태에 따라 동적으로 변경.

---

형님, 이렇게 하면 처음 뜰 때는 그 묵직한 맛이 나고, 사용 중에는 스트레스 없이 빠릿빠릿하게 움직일 겁니다. 바로 집도할까요? 🚀
