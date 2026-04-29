# Implementation Plan - App Hub Animation Sluggish Entrance & Snappy Hover

형님, 확실히 '굼뜬' 그 느낌이 그리우셨군요! 😂 
CSS 트랜지션을 빼버리니까 Framer Motion 특유의 빠릿한 반응이 그대로 드러나서 그렇게 느끼시는 것 같습니다. '느리게 등장, 빠르게 호버' 이 상반된 느낌을 완벽하게 조화시켜 보겠습니다.

## 📋 변경 사항

### 1. `components/AppLibraryModal.tsx`

- **등장 애니메이션 (Entrance) - 더 굼뜨게!**
  - `visible` 변이의 `stiffness`를 기존(90~160)보다 훨씬 낮은 **40~70** 수준으로 대폭 낮춥니다.
  - `damping`을 약간 높여서 묵직하게 '스르륵' 올라오는 느낌을 강조합니다.
  - 이렇게 하면 CSS 트랜지션의 도움 없이도 Framer Motion만으로 형님이 좋아하시던 그 굼뜬 느낌을 낼 수 있습니다.
- **마우스 오버 (Hover) - 여전히 빠릿하게!**
  - `whileHover`의 `stiffness: 400`은 그대로 유지합니다. 
  - 등장과 호버의 스프링 설정이 완전히 독립되어 있으므로, 처음 뜰 때만 느릿하게 동작합니다.

## 🛠️ 작업 단계

1. `components/AppLibraryModal.tsx` 내 `AppCard`의 `visible` variant transition 수치 하향 조정.
2. `whileHover` transition 수치 확인 및 유지.

---

형님, 이번에는 '스르륵~ 착!' 이 조화를 확실히 보여드리겠습니다. 바로 진행할까요? 🐧✨
