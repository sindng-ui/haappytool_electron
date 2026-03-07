# [Split Analysis UI 보완] 분석 버튼 위치 조정 및 너비 고정
  
분석 작업 실행 시 `Analyze Diff` 버튼의 위치를 `Single|Split` 전환 버튼의 왼쪽으로 옮기고, 고정 너비를 적용하여 텍스트 변경 시 발생하는 레이아웃 흔들림을 원천 차단합니다.

## Proposed Changes

### TopBar Layout & Button Stability

#### [MODIFY] [TopBar.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/TopBar.tsx)
- **위치 변경**: `Analyze Diff` 버튼 렌더링 위치를 `Layout Toggle (Single|Split)` 컴포넌트 바로 앞(왼쪽)으로 이동합니다.
- **너비 고정**: 버튼에 `w-[130px]` 고정 너비를 적용합니다.
- **정렬 최적화**: `justify-center`를 추가하여 아이콘과 텍스트가 항상 버튼 중앙에 오도록 합니다.
- **여백 조정**: 버튼 이동에 따른 `ml-2` 등 마진 값을 시각적으로 자연스럽게 조정합니다.

## Verification Plan

### Manual Verification
1. `Analyze Diff` 버튼이 `Single|Split` 버튼의 왼쪽에 위치하는지 확인합니다.
2. 분석 시작/완료 시 버튼 텍스트가 바뀌어도 버튼 자체의 크기나 주변 요소들의 위치가 변하지 않는지 확인합니다.
3. 시각적으로 레이아웃이 안정적이고 "느낌이 사는지" 확인합니다. 🐧✨
