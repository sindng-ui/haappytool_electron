# Implementation Plan - App Hub "Direct Slide Entrance" (No Fade-in)

형님, 새로운 스타일 실험 좋습니다! 🐧🧪
카드들이 투명하게 나타나는 대신, 이미 그려져 있는 상태에서 각자 자기 위치를 찾아 '착착' 이동하는 **'다이렉트 슬라이딩'** 방식으로 변경하겠습니다.

## 📋 변경 사항

### 1. `components/AppLibraryModal.tsx`

- **섹션 가시화 (Section Visibility)**
  - `Section` 컴포넌트의 초기 상태(`hidden`)에서 `opacity: 0`을 제거하고 **`opacity: 1`**로 설정합니다. 제목과 선들이 즉시 보입니다.
- **카드 가시화 (Card Visibility)**
  - `AppCard` 컴포넌트의 초기 상태(`hidden`)에서도 **`opacity: 1`**을 적용합니다. 
  - 이제 카드들은 투명하게 나타나는 대신, 처음부터 제 형태를 유지한 채로 지정된 오프셋(`y: 30`, `rotate` 등)에서 제자리로 **슬라이딩**하며 찾아옵니다.

## 🛠️ 작업 단계

1. `Section` 컴포넌트의 `hidden` variant 수정.
2. `AppCard` 컴포넌트의 `hidden` variant 수정.

---

형님, 이렇게 하면 카드들이 몽환적으로 나타나는 대신, 훨씬 더 물리적이고 실체감 있게 느껴질 겁니다. 바로 적용해 볼까요? 🚀
