# 🚀 Find Results Sticky Header 네네이티브 복구 구현 계획서

형님! `Virtuoso` 리스트의 커스텀 리스트 컴포넌트 연동 문제로 인한 Sticky Header 미동작 현상을 완벽하게 해결하기 위한 구현 계획서입니다. 🐧⚡

## 1. 개요 및 분석
- **원인**:
  1. `react-virtuoso`에서 `components.List` 속성으로 커스텀 컴포넌트(`ListContainer`)를 제공해 내부 패딩을 먹이면, 가상화 엔진의 스크롤 및 Sticky 포지셔닝 오프셋(translateY) 계산이 내부적으로 망가져 헤더가 가상화 영역 밖으로 밀려나 사라지는 고질적인 버그가 확인되었습니다.
  2. 2중 sticky 클래스가 이미 제거된 상태이므로, `Virtuoso`가 네이티브로 제공하는 렌더링에만 순수하게 의존하도록 구성하면 정상 작동합니다.
- **해결책**:
  1. `ListContainer` 커스텀 컴포넌트 지정을 완전히 제거하여 `Virtuoso` 고유의 렌더링 컨테이너를 복원합니다.
  2. 부모 컨테이너에 `p-3` 패딩을 다시 복구하여 레이아웃의 여백 정렬을 회복시킵니다.
  3. `Virtuoso` 엔진에 `stickyHeaderIndices` 고정 처리를 100% 온전히 맡겨 브라우저 네이티브 Sticky 기능이 안정적으로 작동하게 만듭니다.

---

## 2. 변경 계획 (Proposed Changes)

### 📂 `components/LogViewer`

#### [MODIFY] [GlobalSearchResultView.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/GlobalSearchResultView.tsx)
- `ListContainer` 컴포넌트 정의 제거.
- 부모 `div` 클래스에 `p-3` 패딩 다시 추가 (`flex-1 overflow-hidden bg-slate-950/10 p-3`).
- `Virtuoso` 컴포넌트의 `components={{ List: ListContainer }}` 속성 제거.

---

## 3. 검증 계획 (Verification Plan)

### 수동 검증
1. 검색 결과를 노출한 후 스크롤을 내립니다.
2. 각 파일의 경계 부분에서 파일명 타이틀 헤더가 결과 트리 최상단에 **완벽하게 고정(Sticky Header)**된 채 텍스트를 덮어주는지 확인합니다.
3. 스크롤을 내림에 따라 다음 파일 헤더가 이전 파일 헤더를 밀어 올리며 고정 상태가 부드럽게 세대 교체되는지 모션을 검증합니다.

---

## 4. 유저 승인 및 진행 (Proceed)

형님! 계획서 검토 부탁드립니다. 승인해 주시면 네이티브 가상화 Sticky Header 복구 패치를 바로 이식하겠습니다! 🐧🥊

[**[ Proceed - 코딩 진행하기 ]**] (유저 승인 필요)
