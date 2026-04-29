# Implementation Plan - App Hub Animation Start Delay Restore

형님, 카드들이 나타나기 전의 그 여유로운 기다림! 다시 찾아드리겠습니다. 🐧✨
제가 최적화하면서 딜레이를 너무 깎아버려서 카드들이 모달이 뜨자마자 너무 성급하게 튀어나왔던 것 같네요. 형님이 좋아하시던 그 **'잠시 뜸을 들였다가 차례대로 나오는'** 느낌을 복구하겠습니다.

## 📋 변경 사항

### 1. `components/AppLibraryModal.tsx`

- **컨텐츠 등장 딜레이 상향**
  - `delayChildren`: `0.02` -> **`0.25`**: 모달이 열리고 나서 약 0.25초 정도 뜸을 들인 후에 카드들이 움직이기 시작하도록 변경합니다.
  - `staggerChildren`: `0.03` -> **`0.04`**: 카드들 사이의 간격을 살짝 더 벌려서 리듬감을 더 강조합니다.

## 🛠️ 작업 단계

1. `components/AppLibraryModal.tsx` 내 `Scrollable Content` 영역의 `delayChildren` 및 `staggerChildren` 수치 상향.
2. `APP_MAP.md`에 애니메이션 리듬 최적화 내용 업데이트.

---

형님, 이제 모달이 딱 뜨고 나서 잠시 숨을 고른 뒤에 카드들이 제각각 멋지게 등장할 겁니다. 바로 적용할까요? 🚀
