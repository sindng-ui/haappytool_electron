# Implementation Plan - App Hub Layout Optimization

App Hub 모달의 디자인을 더욱 세련되고 콤팩트하게 개선하기 위해, 불필요하게 넓은 여백을 조정하고 정보 밀도를 최적화합니다.

## 📋 변경 사항

### 1. `components/AppLibraryModal.tsx`

- **헤더 영역 (Header)**
  - `p-8 pb-4` -> `p-6 pb-3`: 상단 및 좌우 여백을 줄여 타이틀 영역의 높이를 압축합니다.
- **콘텐츠 영역 (Scrollable Content)**
  - `py-8` -> `py-6`: 스크롤 영역의 상하 패딩을 조절하여 첫 섹션이 더 빨리 보이도록 합니다.
  - `space-y-16` -> `space-y-10`: "Pinned Tools"와 "Labs" 섹션 사이의 과도한 간격(64px)을 40px로 줄입니다.
- **섹션 타이틀 (Section Title)**
  - `mb-10` -> `mb-6`: 섹션 제목과 앱 카드들 사이의 간격을 줄입니다.
  - `p-3` -> `p-2`: 섹션 아이콘의 배경 패딩을 줄여 더 콤팩트하게 만듭니다.
  - `ml-8` -> `ml-5`: 제목 옆 그라데이션 라인의 시작 위치를 당겨 시각적 균형을 맞춥니다.

## 🛠️ 작업 단계

1. `components/AppLibraryModal.tsx` 파일의 Tailwind CSS 클래스 수정.
2. `APP_MAP.md` 파일에 변경 사항 업데이트.

## 🧪 테스트 계획

- App Hub 모달을 열어 상단 여백이 적절히 줄어들었는지 확인.
- Pinned Tools와 Labs 섹션 간의 간격이 자연스러운지 확인.
- 전체적인 레이아웃이 답답하지 않으면서도 콤팩트하게 느껴지는지 시각적 검토.

---

형님, 위 계획대로 진행할까요? `proceed`라고 말씀해 주시면 바로 작업 시작하겠습니다! 🐧✨
