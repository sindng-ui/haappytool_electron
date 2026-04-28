# App Library 다이나믹 리뉴얼 계획서

## 1. 개요
단조로운 격자 형태의 앱 목록을 가변 크기와 고유 컬러 글로우가 적용된 다이나믹 레이아웃(Bento Grid)으로 개선하여 "졸졸하게 있는 느낌"을 탈피합니다.

## 2. 세부 구현 계획

### 2.1. 가변 카드 시스템 도입
- **Large Card (2x2)**: 가장 자주 사용되는 첫 번째 Pinned App에 적용.
- **Wide Card (2x1)**: Pinned 섹션의 주요 도구들에 적용.
- **Normal Card (1x1)**: 그 외 일반 앱들에 적용.

### 2.2. 시각적 정체성 강화
- **Aura Effect**: `ICON_THEMES`의 컬러를 활용한 카드 배경 Radial Gradient 글로우 추가.
- **Ghost Typography**: 카드 내부 배경에 앱 이름을 배경 텍스트로 삽입 (Premium Look).
- **Glass-morphism 2.0**: 더 깊은 그림자와 고대비 테두리를 사용하여 플로팅 효과 강조.

### 2.3. 레이아웃 엔진 수정 (`AppLibraryModal.tsx`)
- `Section` 컴포넌트 내의 `grid` 클래스를 `grid-cols-6 grid-flow-row-dense`로 변경.
- 인덱스에 따라 `col-span`, `row-span`을 동적으로 부여하는 로직 추가.

## 3. 작업 순서
1. `AppLibraryModal.tsx` 백업 및 구조 분석.
2. `AppCard` 컴포넌트 기능 확장 (Variants 지원).
3. Bento Grid 레이아웃 로직 적용.
4. 애니메이션 및 글로우 효과 튜닝.

## 4. 진행 여부
형님, 이대로 진행할까요?

<button>Proceed</button>
