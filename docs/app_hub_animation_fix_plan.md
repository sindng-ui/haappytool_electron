# Implementation Plan - App Hub Hover Animation Snappiness

형님, 앱 카드 마우스 오버 시의 애니메이션이 굼뜨게 느껴지셨군요! 현재 CSS 트랜지션 시간이 너무 길게 잡혀 있고(500ms), 애니메이션 강도가 약해서 생기는 현상입니다. 이를 아주 쫀득하고 기분 좋게 '착착' 감기도록 개선하겠습니다. 🐧✨

## 📋 변경 사항

### 1. `components/AppLibraryModal.tsx`

- **AppCard 컴포넌트 스타일 수정**
  - `duration-500` -> `duration-200`: 전체적인 트랜지션 반응 속도를 2배 이상 끌어올립니다.
- **애니메이션 속성 고도화**
  - `whileHover`: `scale: 1.03` -> `1.05`, `y: -8` -> `-10`으로 피드백을 강화합니다.
  - **스프링 옵션 추가**: `stiffness: 400`, `damping: 15` 정도의 강력한 스프링을 적용하여 마우스가 닿는 즉시 튀어 오르는 느낌을 줍니다.
  - `whileTap`: 클릭 시에도 `scale: 0.95` 정도로 더 깊이 눌리는 느낌을 주어 손맛을 살립니다.

## 🛠️ 작업 단계

1. `components/AppLibraryModal.tsx` 파일 내 `AppCard`의 `motion.button` 속성 및 Tailwind 클래스 수정.
2. `APP_MAP.md`에 애니메이션 최적화 내용 업데이트.

---

형님, 이렇게 바꾸면 앱 카드 건드리는 재미가 쏠쏠할 겁니다. 바로 적용해 드릴까요? 🚀
