# BlockTest 파이프라인 Timeout 이슈 해결 계획

BlockTest 플러그인에서 `sdb shell` 명령(특히 launch, exit 관련) 실행 시 발생하는 10초 타임아웃 문제를 해결하기 위한 분석 및 개선 계획입니다.

## 분석 결과

1.  **프론트엔드 타임아웃 제한:** `useBlockTest.ts` 파일의 `runCommand` 함수에 10초(`10000ms`)가 하드코딩되어 있습니다. `sdb shell` 명령은 기기 상태나 명령 종류에 따라 10초 이상 소요될 수 있습니다.
2.  **백엔드 프로세스 제어 부재:** 서버(`server/index.cjs`)에서 `child_process.exec`를 사용하여 명령을 실행하는데, 백엔드 측의 타임아웃이나 프로세스 종료(Kill) 로직이 없어 명령이 멈추면 서버 자원이 계속 점유될 가능성이 있습니다.
3.  **명령 특성:** 'launch' 명령은 앱 초기화 시간에 따라 10초를 초과하기 쉬우며, 'exit' 명령어 역시 기기 부하가 높은 상태에서는 응답이 느려질 수 있습니다.

## 제안 사항

### 1. 프론트엔드 타임아웃 연장 및 유연화
- 기본 타임아웃을 30초로 연장합니다.
- (옵션) 블록 설정에서 타임아웃을 직접 지정할 수 있는 필드를 추가하는 것을 고려합니다. (이번에는 우선 기본값 상향부터 진행)

### 2. 백엔드 실행 로직 개선
- `run_host_command` 핸들러에 백엔드 자체 타임아웃을 추가합니다.
- `exec` 대신 `spawn` 사용을 고려하거나, `exec` 결과 대기 중 타임아웃 발생 시 프로세스를 강제 종료하도록 개선합니다.

### 3. 디버그 로그 강화
- 백엔드에서 명령의 시작/종료 시간 및 상세 오류 내용을 더 자세히 출력하여 원인 파악을 쉽게 합니다.

---

## Proposed Changes

### [Component Name] BlockTest Plugin (Frontend)

#### [MODIFY] [useBlockTest.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/BlockTest/hooks/useBlockTest.ts)
- `runCommand` 내의 타임아웃 값을 10000(10초)에서 30000(30초)으로 상향 조정합니다.
- 타임아웃 발생 시 어떤 명령에서 발생했는지 로그에 명시합니다.

### [Component Name] Server (Backend)

#### [MODIFY] [index.cjs](file:///k:/Antigravity_Projects/gitbase/happytool_electron/server/index.cjs)
- `run_host_command` 핸들러에 타임아웃 로직을 추가합니다 (약 35초).
- 명령 실행 프로세스가 타임아웃되면 해당 프로세스를 `kill` 하여 좀비 프로세스 생성을 방지합니다.

---

## Verification Plan

### Automated Tests
- `run_host_command`를 통해 일부러 10초 이상 걸리는 명령(예: `wsl sleep 15`)을 실행하여 파이프라인이 정상적으로 대기하고 완료되는지 확인합니다.
- 30초 이상의 명령을 실행하여 백엔드/프론트엔드 타임아웃이 의도대로 동작하는지 확인합니다.

### Manual Verification
- 실제 Tizen 기기를 연결하여 'launch'와 'exit' 블록이 포함된 파이프라인을 실행하고 타임아웃 없이 정상 동작하는지 확인합니다.
- 기기 연결을 해제한 상태에서 `sdb` 명령이 실패할 때의 에러 처리가 정확한지 확인합니다.

## Open Questions

- 형님, 타임아웃을 30초로 늘리는 것이 적당할까요? 아니면 더 길게(예: 60초) 잡을까요?
- 특정 앱의 경우 launch가 매우 느릴 수 있는데, 블록별로 타임아웃을 설정할 수 있는 기능을 바로 추가할까요?

## Proceed
[PROCEED](command:antigravity.approvePlan)
