# 🚀 Find Results Flat 가상화 및 Sticky Header 구현 계획서

형님! 검색 결과 목록 스크롤 시 파일명이 위로 말려올라가 가려지는 UX 문제를 원천 진압하고, 이중 스크롤바를 근절하기 위한 **결과 트리 전체 가상 스크롤화(Flat Virtuoso) 및 Sticky Header** 구현 계획서입니다. 🐧⚡

## 1. 개요 및 분석
- **현상**: 각 파일 노드마다 최대 400px 높이의 개별 스크롤러를 두고, 부모 결과 트리에도 스크롤러가 있어 이중 스크롤바가 생성됩니다. 부모 스크롤을 내리면 파일 헤더가 위로 밀려 사라져 어떤 파일인지 알 수 없게 됩니다.
- **해결책**:
  1. 결과 트리 전체를 **단 하나의 `Virtuoso`** 스크롤러로 교체합니다.
  2. 파일 헤더와 매치 라인들을 단일 플랫 배열(`FlatItem[]`)로 펼치고, 접힘/펼침 상태(`collapsedTabs`)를 이 플랫 배열 생성 시 동적 필터링합니다.
  3. `Virtuoso`의 공식 속성인 **`stickyHeaderIndices`**를 연동하여, 현재 스크롤 중인 영역의 파일명 헤더가 스크롤러 상단에 완벽하게 고정(Sticky)되도록 설계합니다.

---

## 2. 변경 계획 (Proposed Changes)

### 📂 `components/LogViewer`

#### [MODIFY] [GlobalSearchResultView.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/GlobalSearchResultView.tsx)
- `FlatItem` 유니온 타입 정의:
  ```typescript
  type FlatItem =
    | { type: 'header'; tabRes: TabSearchResult; uniqueKey: string; matchesCount: number }
    | { type: 'match'; tabRes: TabSearchResult; match: SearchMatch };
  ```
- `flatItems`와 `stickyHeaderIndices`를 `useMemo`로 추출.
- 결과 트리 렌더링 영역의 부모 `div` 및 개별 파일 노드 `map` 루프를 제거하고, 전체를 단일 `Virtuoso` 컴포넌트로 전환.
  - `Virtuoso`에 `style={{ height: '100%' }}` 및 `stickyHeaderIndices` 전달.
  - `itemContent` 내에서 `item.type === 'header'`와 `'match'` 분기를 타서 기존 UI 컴포넌트를 정확하게 일체화 렌더링.

---

## 3. 검증 계획 (Verification Plan)

### 수동 검증
1. 검색 결과를 여러 파일에 걸쳐 대량으로 노출시킵니다.
2. 스크롤을 끝까지 내려보며, 우측에 단 하나의 통합 스크롤바만 표시되는지 확인합니다.
3. 스크롤 시 화면 상단에 현재 보고 있는 매치 라인의 **파일명 타이틀 헤더가 완벽히 고정(Sticky Header)**되어 밀려나지 않는지 검증합니다.
4. 다음 파일의 매치 구간으로 넘어가면 이전 파일 헤더가 다음 헤더에 의해 자연스럽게 위로 밀려 올라가는지 확인합니다.
5. 접기/펴기(Collapse/Expand) 클릭 시 리스트가 즉시 갱신되어 반영되는지 체크합니다.

---

## 4. 유저 승인 및 진행 (Proceed)

형님! 계획서 검토 부탁드립니다. 이 구조가 이중 스크롤바도 없애고 타이틀도 늘 보여주는 궁극의 해결책입니다. 승인해주시면 바로 코딩 들어가겠습니다! 🐧🥊

[**[ Proceed - 코딩 진행하기 ]**] (유저 승인 필요)
