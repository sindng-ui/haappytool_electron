# SpeedScope 통합 비교 모드 (Differential Flame Graph) 구현 계획

현재 SpeedScope 플러그인의 비교 모드는 두 개의 JSON을 단순히 좌우로 배치하여 보여주는 수준입니다. 이를 개선하여 두 프로파일 간의 성능 차이(Delta)를 시각적으로 통합하여 보여주는 기능을 구현합니다.

## User Review Required

> [!IMPORTANT]
> **시각화 방식 결정**: 타겟(Target, 보통 두 번째 파일)의 호출 트리 구조를 기준으로 베이스(Base, 첫 번째 파일)와의 차이를 보여줄 예정입니다. 베이스에는 있고 타겟에는 없는 '삭제된 함수'는 별도의 리스트나 'Ghost' 처리로 보여줄 수 있는데, 우선은 타겟 구조 기반의 델타 시각화에 집중하겠습니다.

> [!TIP]
> **매칭 정밀도**: 함수 이름과 스택 깊이가 동일한 경우를 매칭 대상으로 합니다. 만약 스택 구조가 많이 바뀌었다면 매칭이 어려울 수 있으나, 일반적인 성능 최적화 전후 비교에는 매우 효과적입니다.

## Proposed Changes

### 1. 데이터 분석 레이어 (Worker & Utils)
두 프로파일의 데이터를 비교 분석하여 델타 값을 계산하는 로직을 추가합니다.

#### [NEW] [performanceDiff.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/utils/performanceDiff.ts)
- 두 `AnalysisResult`를 입력받아 각 세그먼트별로 매칭되는 베이스 세그먼트를 찾고 델타(시간 차이)를 계산하는 유틸리티.
- 함수 통계(`functionStats`) 비교 로직 포함.

#### [MODIFY] [SpeedScopeParser.worker.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/workers/SpeedScopeParser.worker.ts)
- 비교 분석을 워커에서 처리할 수 있도록 `COMPARE_PROFILES` 액션 추가 (선택 사항, 데이터가 크지 않으면 메인 스레드에서 처리 가능).

### 2. UI 컴포넌트 레이어
통합 비교를 위한 새로운 시각화 컴포넌트를 추가합니다.

#### [NEW] [PerfFlameDiff.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/SpeedScope/PerfFlameDiff.tsx)
- `PerfFlameGraph`를 기반으로 하되, 색상을 델타 값에 따라 결정하는 특수 FlameGraph.
- **Red**: 대상이 더 느림 (+시간)
- **Blue**: 대상이 더 빠름 (-시간)
- **Green**: 신규 추가됨
- **Gray**: 변화 미미함

#### [MODIFY] [SpeedScopePlugin.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/SpeedScope/SpeedScopePlugin.tsx)
- 'Unified Compare' 버튼 추가.
- 비교 상태(`isUnifiedCompare`) 관리.
- 두 파일이 로드되었을 때 활성화되는 비교 뷰 레이아웃 구현.

### 3. 디자인 시스템 및 스타일
- `index.css`에 델타 색상 관련 CSS 변수 정의 (필요 시).
- 프리미엄 다크 모드에 어울리는 색상 팔레트 사용.

## Open Questions

- **삭제된 세그먼트 표시**: 베이스에는 있었지만 타겟에서 사라진 세그먼트를 어떻게 보여줄까요? (예: 별도 리스트로 제공 혹은 타겟 그래프 하단에 작게 표시)
- **매칭 기준**: 단순 함수 이름 매칭 외에 전체 스택 경로 매칭을 기본으로 할까요? (스택 경로 매칭이 더 정확하지만 노이즈에 민감할 수 있습니다.)

## Verification Plan

### Automated Tests
- `performanceDiff.test.ts`를 생성하여 다양한 케이스(추가, 삭제, 시간 증가/감소)에 대한 매칭 및 델타 계산 검증.

### Manual Verification
- 동일한 JSON 두 개를 넣었을 때 모두 회색으로 나오는지 확인.
- 의도적으로 시간을 수정한 두 JSON을 비교하여 색상이 올바르게 변하는지 확인 (Red/Blue).
- 줌/팬 동작이 통합 뷰에서도 매끄럽게 동작하는지 확인.

---

형님, 이 계획대로 진행해도 될까요? 승인해주시면 바로 작업 들어가겠습니다!
<div id="proceed-button"></div>
