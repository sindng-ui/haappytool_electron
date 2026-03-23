# Block Test 플러그인 타이머 추가 계획서 🐧

형님! Block Test 플러그인이 실행될 때 전체 진행 시간을 실시간으로 확인할 수 있도록 타이머 기능을 추가하겠습니다. `useBlockTest` 훅에서 시간을 통합 관리하여 어떤 화면에서도 끊김 없이 시간을 확인할 수 있게 하겠습니다.

## Proposed Changes

### [Logics]
#### [MODIFY] [useBlockTest.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/BlockTest/hooks/useBlockTest.ts)
- `elapsedTime` 상태 추가 (초 단위)
- `isRunning`이 `true`가 될 때 타이머 시작, `false`가 될 때 중지
- `executePipeline` 및 `executeScenario` 시작 시 시간 초기화

### [Components & UI]
#### [MODIFY] [index.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/BlockTest/index.tsx)
- `useBlockTest`에서 제공하는 `elapsedTime`을 하위 Runner 컴포넌트(`ScenarioRunner`, `PipelineRunner`)로 전달

#### [MODIFY] [ScenarioRunner.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/BlockTest/components/ScenarioRunner.tsx) & [PipelineRunner.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/BlockTest/components/PipelineRunner.tsx)
- `elapsedTime` prop 추가
- 상단 헤더 영역에 경과 시간 표시 (예: `⏱ 12s`)
- 실행 중일 때는 실시간 업데이트, 종료 후에는 최종 소요 시간 고정 표시

## Verification Plan

### Manual Verification
1. Block Test 플러그인 진입
2. 임의의 Pipeline 또는 Scenario 실행
3. 상단 헤더에 "Running..." 문구와 함께 초 단위로 시간이 올라가는지 확인
4. 실행 중지 또는 완료 시 타이머가 멈추고 최종 시간이 유지되는지 확인
5. 다른 Pipeline으로 전환하거나 창을 닫았다 열었을 때(실행 중인 경우) 시간이 동기화되는지 확인

---
[Proceed](command:antigravity.proceed)
