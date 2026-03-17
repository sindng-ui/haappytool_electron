# SpeedScope & LogViewer 고도화 통합 계획서 🐧⚡🔍🎨

형님! 요청하신 다양한 개선 사항들을 한데 모아 완벽하게 정리했습니다. Speedscope 컬링부터 레이아웃 정상화까지 제가 책임지고 멋지게 만들어 보겠습니다! 🐧🔥

## 🎯 주요 개선 사항

### 1. Speedscope 스타일 이름 기반 컬러링 🎨
- **목표**: 함수 이름을 해싱하여 Speedscope처럼 고유한 색상을 부여합니다.
- **수정 파일**: `utils/perfAnalysis.ts`, `workers/SpeedScopeParser.worker.ts`, `PerfFlameGraphRenderer.ts`
- **로직**: `getSegmentColor(name)` 함수를 구현하여 HSL 기반의 안정적인 색상을 생성하고 적용합니다.

### 2. 검색 엔진 고도화 (대소문자 무시 & 즉시 업데이트) 🔍
- **목표**: 검색 시 대소문자 구분을 없애고, 키워드 추가/삭제 시 차트가 즉시 갱신되도록 합니다.
- **수정 파일**: `usePerfDashboardState.ts`, `PerfTopBar.tsx`, `PerfFlameGraph.tsx`
- **로직**: `toLowerCase()`를 적용한 매칭 시스템과 의존성 배열 보강을 통해 반응성을 극대화합니다.

### 3. 지표 변경 (Pass Rate -> Slow Ops) ⚡
- **목표**: 의미가 적은 % 지표 대신 성능 임계치를 넘은 "Slow Ops (개수)"를 강조합니다.
- **수정 파일**: `PerfTopBar.tsx`, `PerfDashboardSummary.tsx`
- **로직**: `Scorecard`의 레이블과 값을 실시간 `failCount`로 대체하고 아이콘과 색상을 경고 스타일로 변경합니다.

### 4. UI 레이아웃 정상화 및 안정화 🛠️
- **목표**: `TopBar`의 버튼 순서를 형님이 원하시는 대로 (`Analyze Diff`가 `Split` 왼쪽으로) 복구하고 레이아웃을 고정합니다.
- **수정 파일**: `TopBar.tsx`
- **로직**: 버튼 렌더링 순서를 조정하고 `pr-[200px]` 등의 여백 설정을 유지하여 윈도우 컨트롤과 겹치지 않게 합니다.

## 🧪 검증 계획
- [ ] **컬러링**: 동일 함수는 항상 동일 색상, 다른 함수는 다른 색상인지 확인.
- [ ] **검색**: `native`와 `Native` 검색 시 동일한 하이라이트 결과 확인.
- [ ] **지표**: Threshold 변경에 따라 `Slow Ops` 개수가 실시간 변하는지 확인.
- [ ] **레이아웃**: 윈도우 크기에 상관없이 버튼들이 캡쳐와 동일한 위치에 있는지 확인.

형님! 이 통합 계획서대로 시원하게 작업 들어가겠습니다. 아래 버튼 눌러주십쇼! 거거! 🐧🚀🔥

<button onclick="alert('Proceeding with the integrated plan!')">Proceed</button>
