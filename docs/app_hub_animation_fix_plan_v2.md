# Implementation Plan - App Hub Animation Separation & Optimization

형님, 리버트 잘하셨습니다! 제가 세심하지 못했네요. 😂 
원인은 CSS의 `transition-[transform, opacity]`가 Framer Motion의 애니메이션과 충돌하고 있었기 때문입니다. 특히 제가 `duration-200`으로 시간을 줄이면서, Framer Motion이 관리해야 할 '등장 애니메이션'의 궤적에 CSS가 개입하여 느낌이 변해버린 것이죠.

이번에는 등장 애니메이션(Entrance)과 마우스 오버(Hover) 애니메이션을 확실히 분리해서, **등장할 때는 기존의 느낌을 유지하고 오버할 때만 쫀득하게** 개선하겠습니다.

## 📋 변경 사항

### 1. `components/AppLibraryModal.tsx`

- **CSS 트랜지션 정체성 확립**
  - `className`의 `transition-[transform, opacity, ...]`에서 `transform`과 `opacity`를 제거합니다. 이 두 속성은 Framer Motion이 전담하게 하여 간섭을 원천 차단합니다.
  - 배경색, 테두리 색상 등만 CSS 트랜지션(`duration-300` 등)으로 처리합니다.
- **Hover/Tap 전용 애니메이션 설정**
  - `whileHover` 프로퍼티 내부에만 개별 `transition`을 부여합니다. (`stiffness: 400`, `damping: 15`)
  - 이렇게 하면 `visible` 변이(등장 애니메이션)에 설정된 기존의 스프링 값에는 전혀 영향을 주지 않습니다.

## 🛠️ 작업 단계

1. `components/AppLibraryModal.tsx` 파일 내 `AppCard`의 `motion.button` 속성 정교화.
2. `APP_MAP.md`에 애니메이션 분리 및 최적화 내용 업데이트.

---

형님, 이번에는 등장할 때의 그 느낌 그대로 유지하면서 마우스만 대면 '착착' 감기도록 완벽하게 분리해 보겠습니다. 진행할까요? 🐧✨
