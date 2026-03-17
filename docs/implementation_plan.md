# Speedscope 정밀 튜닝 및 버그 수정 계획서

형님! 색상을 Speedscope와 1:1로 맞춘 후, 추가적으로 요청하신 UI 위치 조정 및 동작 버그 수정을 진행하겠습니다.

## Proposed Changes

### 1. Fail Threshold UI 개선 및 로직 수정
- [MODIFY] [PerfTopBar.tsx](../../components/LogViewer/PerfDashboard/PerfTopBar.tsx)
    - 상단 헤더의 쌩뚱맞은 위치 대신, 차트 상단 툴바의 'Fail Only' 버튼 옆으로 입력 필드를 이동합니다.
- [MODIFY] [usePerfDashboardState.ts](../../components/LogViewer/usePerfDashboardState.ts)
    - `perfThreshold` 상태를 추가하여, 입력 시마다 차트의 색상(위험도) 및 필터링이 실시간으로 반영되도록 개선합니다.
- [MODIFY] [PerfDashboard.tsx](../../components/LogViewer/PerfDashboard.tsx)
    - 새로운 상태와 핸들러를 하위 컴포넌트로 전달합니다.

### 2. All Instances 통계 데이터 복구
- [MODIFY] [SpeedScopePlugin.tsx](../../components/SpeedScope/SpeedScopePlugin.tsx)
    - `switchProfile` 함수에서 워커로부터 받은 `functionStats` 데이터를 누락시키던 버그를 수정하여 상세 패널의 'All Instances' 정보가 정상 출력되도록 합니다.
    - 기존 헤더에 있던 Fail Threshold 입력을 제거합니다 (PerfTopBar로 이동).

### 3. 실시간 필터링 성능 최적화
- [MODIFY] [usePerfFlameData.ts](../../components/LogViewer/usePerfFlameData.ts)
    - `perfThreshold` 변경 시 세그먼트의 `status`를 매번 바꾸는 대신, 렌더링 및 필터링 시점에 동적으로 계산하여 성능 저하를 방지합니다.

## Verification Plan

### Automated Tests
- `npm run test`를 통해 기존 로그 분석 기능에 영향이 없는지 확인합니다.

### Manual Verification
- Speedscope JSON 로드 후, 하위 툴바에서 `Fail Threshold`를 100 -> 2000으로 변경하며 차트의 색상이 실시간으로 변하는지 확인합니다.
- 특정 함수 클릭 시 'All Instances' 테이블에 해당 함수의 전체 통계가 정상적으로 나오는지 확인합니다.

<button>Proceed</button>
