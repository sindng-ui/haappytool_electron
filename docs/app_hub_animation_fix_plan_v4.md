# Implementation Plan - App Hub "Slow Entrance, Snappy Hover" (Tailwind Override)

형님, 제가 정답을 찾았습니다! 🐧💡 
형님이 좋아하시는 그 '조금 있다가 움직이기 시작하며 굼뜨게 등장하는 느낌'은 현재의 CSS `duration-500`과 Framer Motion이 절묘하게 섞여서 만들어지는 손맛이었습니다. 

이를 그대로 유지하면서 마우스 오버할 때만 빠릿하게 바꾸기 위해, **Tailwind의 `hover:` 유틸리티를 사용하여 호버 시에만 트랜지션 시간을 강제로 단축**하는 전략을 사용하겠습니다.

## 📋 변경 사항

### 1. `components/AppLibraryModal.tsx`

- **등장 애니메이션 (Entrance)**: **완전 보존**
  - Framer Motion의 `visible` 변이 및 `delay` 설정 등을 현재 리버트된 상태 그대로 유지합니다.
  - 기본 CSS 클래스에 `duration-500`을 유지하여 등장할 때의 그 굼뜬 느낌을 보존합니다.
- **마우스 오버 (Hover)**: **빠릿하게 전환**
  - `className`에 `hover:duration-200`을 추가합니다. 마우스를 올리는 순간 트랜지션 시간이 500ms에서 200ms로 즉시 짧아집니다.
  - `whileHover` 피드백 강화: `scale: 1.05`, `y: -10`으로 더 명확한 반응을 줍니다.
  - `whileTap`: `scale: 0.95`로 쫀득한 클릭감을 줍니다.

## 🛠️ 작업 단계

1. `components/AppLibraryModal.tsx` 내 `AppCard`의 `className`에 `hover:duration-200` 추가.
2. `whileHover`, `whileTap` 수치 조정.

---

형님, 이렇게 하면 처음 뜰 때는 형님이 좋아하시는 그 묵직한 느낌 그대로고, 마우스만 대면 번개처럼 반응할 겁니다. 바로 고고할까요? 🚀
