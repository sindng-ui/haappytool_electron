# Implementation Plan - App Hub "Chaotic Organic Entrance"

형님, 위에서 아래로 정직하게 내려오는 건 우리 스타일이 아니죠! 🐧🎲
카드들이 순서대로 정렬해서 나오는 대신, 각자 자기 내키는 대로 **'뒤죽박죽'** 튀어나오게 해서 더 생동감 넘치고 유기적인 리듬감을 구현하겠습니다.

## 📋 변경 사항

### 1. `components/AppLibraryModal.tsx`

- **순차적 대기 제거 (Stagger Removal)**
  - 컨테이너의 `staggerChildren`을 제거합니다. 이제 위에서 아래로 차례대로 기다리는 정직한 규칙은 사라집니다.
- **랜덤 딜레이 강화 (Chaotic Delay)**
  - 각 카드의 `delay` 계산에서 인덱스(`idx`) 비중을 대폭 줄이거나 없애고, **플러그인 ID 기반의 랜덤성**을 대폭 강화합니다.
  - `delay: 0.2 + (ID 기반 해시 % 15) * 0.04` 같은 공식을 사용하여, 어떤 놈은 먼저 나오고 어떤 놈은 한참 뒤에 나오는 '예측 불가능한' 리듬을 만듭니다.

## 🛠️ 작업 단계

1. `Scrollable Content`의 `staggerChildren` 제거.
2. `AppCard`의 `delay` 공식을 인덱스 기반에서 ID 기반 랜덤 방식으로 변경.

---

형님, 이제 카드들이 군대처럼 줄 서서 나오는 게 아니라, 축제처럼 제각각 신나게 튀어나올 겁니다. 바로 섞어버릴까요? 🚀
