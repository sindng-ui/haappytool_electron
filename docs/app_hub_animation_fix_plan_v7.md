# Implementation Plan - App Hub "Sluggish Randomized Entrance & Bouncy Hover"

형님, 기록해둔 베이스라인을 바탕으로 '등장감은 100% 보존'하면서 '호버만 뾰뵹'하게 바꾸는 정밀 튜닝을 진행하겠습니다. 🐧✨

## 📋 변경 사항

### 1. `components/AppLibraryModal.tsx`

- **CSS 간섭 제거 (가장 중요!)**
  - `className`의 `transition-[...]` 목록에서 `transform`을 제거합니다. 이게 있으면 아무리 뾰뵹하게 만들어도 CSS가 움직임을 뭉개버려서 묵직하게 느껴집니다.
- **등장 애니메이션 (visible) - "Sluggish Randomized" 재현**
  - CSS 트랜지션을 뺐기 때문에, Framer Motion만으로 그 '굼뜬 느낌'을 재현해야 합니다.
  - 기록해둔 베이스라인 수치를 기반으로, **질량(mass)과 댐핑(damping)을 높이고 강도(stiffness)를 낮춰서** CSS가 잡아주던 그 묵직한 리듬감을 FM만으로 100% 복원하겠습니다.
- **마우스 오버 (whileHover) - "Bouncy Pop"**
  - 지난번에 좋아하셨던 `bounce: 0.4` 옵션을 적용합니다.
  - `y: -12`, `scale: 1.06`으로 시원시원한 피드백을 줍니다.

## 🛠️ 작업 단계

1. `AppCard`의 `visible` transition을 "Sluggish Randomized" 스타일로 수치 조정 (베이스라인 기반).
2. `whileHover`에 탄성(Bounce) 옵션 적용.
3. CSS `className`에서 `transform` 제거하여 탄성 효과 극대화.

---

형님, 이번에는 처음 뜰 때의 그 묵직한 리듬감은 그대로 살리면서 마우스만 대면 뾰뵹! 하게 반응하도록 완벽하게 맞춰보겠습니다. 진행할까요? 🚀
