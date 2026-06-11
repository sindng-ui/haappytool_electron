# 🚀 Find Results 파일 헤더 Sticky 고정 구현 계획서

형님! 검색 결과(Find Results) 스크롤 시 현재 어떤 파일의 결과를 보고 있는지 알 수 있도록, 파일명 타이틀 헤더를 상단에 Sticky로 고정하는 UX 개선 계획서입니다. 🐧⚡

## 1. 개요 및 분석
- **문제점**: 검색 결과의 매치 항목이 많을 경우 결과 트리 전체 스크롤이 일어나면서 파일명 헤더(File node header)가 화면 위로 밀려 사라집니다. 이로 인해 스크롤 중간에 어떤 파일의 로그를 보고 있는지 식별하기 어렵습니다.
- **해결책**:
  1. 각 파일 노드 헤더에 CSS `sticky top-0 z-10` 속성을 주어, 해당 파일의 스크롤이 진행되는 동안 화면 상단에 찰떡같이 고정되도록 합니다.
  2. 스크롤되어 흘러가는 텍스트가 헤더 영역에 겹쳐 비쳐 보이지 않도록, 헤더의 배경색을 투명도가 없는 불투명한 짙은 에메랄드색(`bg-emerald-950`)으로 보강합니다.
  3. 파일 노드 컨테이너에 `relative`를 명시하여 sticky 요소가 상하 스크롤 한계 내에서만 정확히 반응하도록 안정화합니다.

---

## 2. 변경 계획 (Proposed Changes)

### 📂 `components/LogViewer`

#### [MODIFY] [GlobalSearchResultView.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/GlobalSearchResultView.tsx)
- 각 파일 노드의 최상위 컨테이너 `div`에 `relative` 클래스 추가.
- 파일 헤더 `div`의 클래스에 `sticky top-0 z-10` 추가 및 투명 배경(`bg-emerald-950/20 hover:bg-emerald-950/40`)을 불투명 배경(`bg-emerald-950 hover:bg-emerald-900`)으로 개선하여 겹침 방지.

---

## 3. 검증 계획 (Verification Plan)

### 수동 검증
1. 여러 파일에서 대량의 검색 결과가 나오도록 검색을 수행합니다.
2. 결과 트리 창을 스크롤하여 파일의 첫 부분이 위로 스크롤되어도 파일명 헤더가 스크롤 영역 상단에 **sticky하게 달라붙어 유지**되는지 검증합니다.
3. 다음 파일 노드의 헤더가 나타나면 이전 파일 헤더가 밀려 올라가며 부드럽게 세션 전환이 일어나는지 모션을 확인합니다.

---

## 4. 유저 승인 및 진행 (Proceed)

형님! 계획서 검토 부탁드립니다. 승인해 주시면 바로 수정 진행하겠습니다! 🐧🥊

[**[ Proceed - 코딩 진행하기 ]**] (유저 승인 필요)
