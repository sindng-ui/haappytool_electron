# 🏷️ 태그 시스템 및 🗺️ 타임라인 미니맵 구현 계획

형님! 요청하신 대로 **태그 시스템**과 **타임라인 미니맵** 기능을 추가해서 릴리즈 히스토리를 더 멋지게 만들어보겠습니다. 

## 개요
1. **태그 시스템**: 각 릴리즈에 성격(Hotfix, Feature 등)을 부여하고 색상으로 구분하여 가독성을 높입니다.
2. **타임라인 미니맵**: 긴 타임라인을 한눈에 보고 원하는 위치로 빠르게 점프할 수 있는 내비게이션 기능을 추가합니다.

## User Review Required

> [!IMPORTANT]
> 태그 색상 정의: 기본적으로 `Hotfix`(Red), `Feature`(Green), `Major`(Blue), `Minor`(Yellow) 등을 프리셋으로 제공하고, 그 외에는 랜덤 색상이나 기본 색상을 적용할 예정입니다. 혹시 선호하시는 특정 컬러 팔레트가 있으신가요?

> [!NOTE]
> 미니맵 위치: 타임라인 하단에 고정된 형태로 배치하여 스크롤 시에도 항상 보이도록 할 계획입니다.

## Proposed Changes

### 1. Data Model & Types
#### [MODIFY] [types.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/ReleaseHistory/types.ts)
- `ReleaseItem` 인터페이스에 `tags?: string[]` 필드 추가.
- 태그별 색상 매핑 상수 정의.

### 2. UI Components (Tags)
#### [MODIFY] [AddReleaseModal.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/ReleaseHistory/components/AddReleaseModal.tsx)
- 태그 입력 필드 추가 (쉼표로 구분하여 입력받거나 태그 칩 형태로 구현).
- 프리셋 태그 선택 기능 추가.

#### [MODIFY] [ReleaseDetailModal.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/ReleaseHistory/components/ReleaseDetailModal.tsx)
- 상세 보기 시 태그를 컬러풀한 배지(Badge) 형태로 표시.

#### [MODIFY] [ListView.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/ReleaseHistory/components/ListView.tsx)
- 리스트 항목 옆에 태그 배지 표시.

### 3. Timeline Enhancements (Mini-map)
#### [MODIFY] [TimelineGraphView.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/ReleaseHistory/components/TimelineGraphView.tsx)
- **MiniMap 컴포넌트** 구현:
    - 전체 날짜 범위를 축약해서 보여주는 캔버스 또는 단순화된 DIV 구조.
    - 현재 뷰포트(보이는 영역)를 나타내는 하이라이트 박스 표시.
    - 미니맵 클릭/드래그 시 메인 타임라인 스크롤 연동.
- **아이템 컬러링**:
    - 첫 번째 태그의 색상을 아이템의 강조색으로 사용하도록 로직 수정.

## Verification Plan

### Automated Tests
- 태그가 포함된 아이템 추가/수정 후 정상 저장 확인.
- 타임라인 스크롤 시 미니맵 뷰포트 박스가 동기화되는지 확인.
- `APP_MAP.md` 업데이트 확인.

### Manual Verification
- 태그 입력 시 실시간으로 배지가 생성되는지 확인.
- 미니맵 드래그를 통해 타임라인 이동이 부드러운지 확인.
- 다양한 해상도에서 미니맵 위치와 크기가 적절한지 확인.

---
형님, 계획서 확인해주시면 바로 작업 들어가겠습니다! [Proceed] 버튼은 형님의 승인 메시지로 대신하겠습니다. 😎
