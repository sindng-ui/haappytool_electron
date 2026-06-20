# [검색창 UX 개선 및 히스토리 콤팩트화 계획서] 🐧⚡

형님! 전체 검색 및 단일 탭 검색 시 열리는 `FindInAllModal`의 UX 편의성을 극대화하고, 검색 히스토리(Recent Searches)가 세로 공간을 과하게 점유하던 비효율을 똑똑하게 해결하기 위한 구현 계획을 수립했습니다.

또한, 기존 `FindInAllModal.tsx`가 500줄을 초과(524줄)하고 있는 상태이므로, 코드 유지보수성과 성능을 위해 서브 컴포넌트들을 개별 파일로 분할하는 리팩토링도 계획안에 포함했습니다. 🥊

---

## 🚨 유저 검토 필요 (User Review Required)

### 1. 검색창 레이아웃 변경 (최상단 이동)
- **기존 구조**: Header -> Recent Searches (검색 이력) -> Happy Combo (포함 키워드) -> Block List (제외 키워드) -> Footer
- **변경 구조**: Header -> **Happy Combo (포함 키워드) [최상단]** -> **Block List (제외 키워드)** -> **Recent Searches (검색 이력) [최하단]** -> Footer
- 키워드를 직접 입력하는 입력창이 최상단으로 올라가서 즉각적으로 검색어 입력 및 튜닝이 가능해집니다.

### 2. 최근 검색어(Recent Searches) UX 개선안 (가로 Carousel 칩 시스템)
- 기존에는 세로로 길게 행을 차지하여 마우스 휠 스크롤을 무조건 유발하고 공간을 파괴했습니다.
- 이를 해결하기 위해 **가로 롤링 칩스(Horizontal Scroll Carousel) 형태**로 개선합니다.
- 단 한 줄의 세로 높이(약 45px)만 점유하며, 최근 10개의 검색 기록을 가로 스크롤을 통해 부드럽게 넘겨보고, 클릭 한 번으로 포함 키워드와 제외 키워드를 복구할 수 있습니다.
- 칩 내부에는 포함 키워드들(예: `1234 + I/ + asdf`)이 표시되고, 제외 키워드가 있을 경우 빨간색 배지(예: `-2 excl.`)로 작게 병기하여 직관성을 높입니다.
- HSL 기반의 예쁜 태그 컬러와 호버 효과를 가미하여 블러(blur) 효과 없이도 매우 세련된 프리미엄 다크 UX를 제공합니다.

### 3. Proceed 버튼
- 형님, 아래 계획을 검토해보시고 마음에 드신다면 **Proceed**를 클릭(혹은 답변)하여 작업을 승인해 주십쇼!

---

## 🛠️ 제안된 변경 사항 (Proposed Changes)

500줄 초과 규칙을 준수하기 위해 `components/LogViewer/FindInAllModal.tsx` 내의 서브 컴포넌트들을 별도 폴더 `components/LogViewer/FindInAll/`에 격리 분리합니다.

### [Log Viewer Component]

#### [NEW] [TagInput.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/FindInAll/TagInput.tsx)
- 기존 `FindInAllModal.tsx` 내의 `TagInput` 컴포넌트를 분리합니다.
- 해피콤보 입력 칩 및 블록 리스트 입력 칩의 UI와 키 이벤트 제어를 전담합니다.

#### [NEW] [HistoryChips.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/FindInAll/HistoryChips.tsx)
- 최근 검색 이력(`useFindInAllHistory` 연동 데이터)을 받아 가로로 렌더링하는 Carousel 칩 리스트 컴포넌트입니다.
- 가로 스크롤 레이아웃 and 콤팩트한 칩 매핑을 제공하고, 우측 상단이나 롤러 우측 끝에 콤팩트한 '지우기(Clear)' 기능을 제공합니다.

#### [NEW] [SectionHeader.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/FindInAll/SectionHeader.tsx)
- 아코디언 토글식 헤더 컴포넌트입니다. `Happy Combo`, `Block List`, `Recent Searches`의 접기/펴기 상태 및 배지를 보여주는 공용 서브 컴포넌트로 분리합니다.

#### [MODIFY] [FindInAllModal.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/FindInAllModal.tsx)
- 524줄의 코드를 서브 컴포넌트 분리를 통해 약 200~250줄 수준으로 초슬림화합니다.
- 레이아웃 배치 순서를 수정합니다: 포함 단어 입력창(`Happy Combo`) -> 제외 단어 입력창(`Block List`) -> 최근 검색 이력(`Recent Searches`)
- 분리된 `TagInput`, `HistoryChips`, `SectionHeader`를 조립하여 동작하게 만듭니다.

---

## 🗺️ APP_MAP 업데이트 예정
- 새로운 UI 파일 및 변경된 서브 컴포넌트의 위치와 규격을 `APP_MAP.md` 파일에 인터페이스에 맞춰 갱신하겠습니다.

---

## 🔍 검증 계획 (Verification Plan)

### 수동 검증
1. `Ctrl + Shift + F` 및 단일 탭 내 `Ctrl + F` 실행 시 모달이 켜지며 `Happy Combo` 입력창이 최상단에 포커스되는지 확인.
2. 최근 검색어(Recent Searches) 영역이 가로 Carousel 형태로 1줄로 콤팩트하게 렌더링되는지 확인.
3. 가로 휠 스크롤이 매끄럽게 동작하고, 개별 칩 클릭 시 포함/제외 키워드가 입력창에 정확하게 복원되는지 확인.
4. `Aa Case` 등의 옵션 단축키 및 검색 수행(`Ctrl + Enter`) 시 기존의 초고속 20,000줄 청크 스캔이 사이드 이펙트 없이 똑같이 초고속으로 작동하는지 확인.
5. 빌드 및 린트 오류가 없는지 최종 확인.

---

형님! 계획서가 마음에 드시면 **Proceed**를 외쳐주세요. 바로 신나게 WSL Bash 켜서 작업 들어가겠습니다! 🐧🏆
