# Timeline 탭 카드 디자인 고도화 (공간 활용 및 시각화) 🐧🎨⚡

형님의 피드백을 반영하여, Timeline 탭의 세그먼트 카드 내 비어 있는 중앙 공간을 성능 차이를 직관적으로 보여주는 **'성능 시각화 브리지'** 영역으로 활용합니다. 기존 좌우로 양분된 레이아웃을 3컬럼 구조로 개편하여 정보 밀도와 시각적 프리미엄을 동시에 잡습니다.

## Proposed Changes

### [Component] Split Analyzer UI 🐧🎨⚡

#### [MODIFY] [SplitAnalyzerPanel.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/SplitAnalyzerPanel.tsx)

1.  **3컬럼 레이아웃 도입**:
    - **Left (Context)**: `FROM` 박스와 `TO` 박스를 포함한 로그 흐름 시각화 (기존보다 컴팩트하게 조정).
    - **Center (Visual Bridge)**: 중앙에 성능 차이를 시각화하는 화살표(Arrow)와 델타 값(+/- ms) 및 상태 배지(REGRESSION/IMPROVEMENT)를 배치.
        - **Impact Gauge**: 델타 값의 크기에 따라 중앙 화살표의 굵기나 애니메이션 속도를 조절하여 임팩트를 시각화.
    - **Right (Metrics)**: 좌측(LEFT)과 우측(RIGHT)의 개별 평균 델타 수치만 깔끔하게 정렬하여 정보 확인의 편의성 증대.

2.  **시각적 디테일 강화**:
    - 중앙 브리지 영역에 그라데이션 라인 및 상태 아이콘(TrendingUp, TrendingDown)을 조화롭게 배치.
    - `isGlobalBatch`인 경우 중앙 영역의 테마를 보라색(Violet)으로 유지하여 일관성 확보.

## Verification Plan

### Automated Tests
- `npm run dev` 실행 중 빌드 에러가 없는지 확인합니다.

### Manual Verification
- 앱을 실행하여 Analyze Diff 결과 화면의 Timeline 탭에서 새로운 3컬럼 레이아웃이 적용되었는지 확인합니다.
- 중앙 공간에 성능 차이가 직관적으로 표시되는지 확인합니다.

---
형님, 이 디자인 컨셉으로 공간을 꽉 채워보겠습니다! 진행하시겠습니까? 🐧🫡⚡
<button>Proceed</button>
