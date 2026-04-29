# Implementation Plan - App Hub Animation Logic Separation (Final)

형님, 원인을 찾았습니다! 🐧🔍 
현재 CSS의 `duration-500`이 `transform`에 걸려 있어서, 마우스를 올리는 **그 찰나의 순간**에 브라우저가 "천천히 움직여라~"라고 간섭을 하고 있었던 겁니다. 아무리 호버 속도를 올려도 CSS가 발목을 잡으니 굼뜨게 느껴졌던 것이죠.

등장 애니메이션(Entrance)과 호버(Hover) 로직을 **코드 레벨에서 완벽하게 분리**하여 간섭을 원천 차단하겠습니다.

## 📋 변경 사항

### 1. `components/AppLibraryModal.tsx`

- **CSS 간섭 완전 차단**
  - `className`의 `transition-[...]`에서 **`transform`과 `opacity`를 완전히 제거**합니다. 이제 이 두 속성은 브라우저가 아닌 Framer Motion이 100% 전담합니다.
- **등장 애니메이션 (Entrance) - "Sluggish Tween"**
  - `visible` 변이에 `type: "tween", ease: "easeOut", duration: 0.5`를 적용합니다. 
  - 이렇게 하면 형님이 좋아하시는 그 **굼뜨고 묵직한 CSS 특유의 느낌**을 Framer Motion만으로 완벽하게 재현할 수 있습니다. (등장감 100% 보존)
- **마우스 오버 (Hover) - "Snappy Bouncy Spring"**
  - `whileHover`에는 여전히 빠릿한 `spring` 설정을 유지합니다. 
  - 이제 CSS의 간섭이 없으므로 마우스를 대는 순간 **지연 시간 없이 즉각적으로** 뾰뵹! 하게 반응합니다.

## 🛠️ 작업 단계

1. `AppCard`의 CSS `className` 수정 (transform/opacity 트랜지션 제거).
2. `visible` variant에 굼뜬 느낌의 `tween` 트랜지션 적용.
3. `whileHover`에 즉각적인 `spring` 트랜지션 유지.

---

형님, 이렇게 하면 '코드는 같이 쓰지만 설정은 완벽히 분리'된 상태가 되어 서로 방해하지 않습니다. 바로 집도 들어갈까요? 🚀
