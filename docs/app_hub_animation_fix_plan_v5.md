# Implementation Plan - App Hub "Bouncy Pop" (뾰뵹) Interaction

형님, '뾰뵹' 하는 그 경쾌한 느낌! 바로 **탄성(Bounce)**이 핵심입니다. 🐧✨
지금은 그냥 빠르게만 움직여서 묵직하게 느껴지는 것인데, 여기에 살짝 튕기는 맛을 더해 아주 기분 좋은 피드백으로 바꿔보겠습니다.

## 📋 변경 사항

### 1. `components/AppLibraryModal.tsx`

- **AppCard 마우스 오버 애니메이션 (whileHover)**
  - `y: -12`, `scale: 1.06`으로 움직임 범위를 살짝 키웁니다.
  - **Bounce 적용**: `type: "spring"`, `stiffness: 400`, `damping: 12`, **`bounce: 0.4`**를 적용합니다. 마우스를 대면 뿅! 하고 튀어 오르는 탄성을 줍니다.
- **등장 애니메이션 (visible)**: **완전 보존**
  - 형님이 원하시는 '굼뜬' 등장감을 유지하기 위해, `visible` 변이의 수치는 건드리지 않겠습니다.
- **CSS 트랜지션 정리**
  - `className`에서 `transform`을 다시 빼겠습니다. CSS 트랜지션이 켜져 있으면 Framer Motion의 '뾰뵹' 하는 미세한 탄성 효과를 다 뭉개버려서 묵직하게 느껴지는 것입니다. 
  - 대신 등장 애니메이션이 너무 빨라지지 않도록 FM 수치를 미세 조정하여 형님이 좋아하시던 그 느낌을 복원하겠습니다.

## 🛠️ 작업 단계

1. `AppCard`의 `whileHover`에 탄성(Bounce) 옵션이 포함된 `transition` 추가.
2. CSS `className`에서 `transform` 제거 (탄성 효과 극대화).
3. `visible` transition을 '굼뜬' 느낌에 최적화.

---

형님, 이번에는 마우스만 대도 기분이 좋아지는 '뾰뵹' 손맛을 확실히 보여드릴게요. 바로 적용할까요? 🚀
