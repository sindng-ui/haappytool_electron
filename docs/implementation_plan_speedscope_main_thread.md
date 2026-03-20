# 속도계 플러그인 메인 스레드 감지 로직 개선 계획서

형님! 속도계(Speedscope) JSON 로드 시 메인 스레드를 더 정확하게 찾을 수 있도록 로직을 개선하는 계획입니다.
`Process32 Process(PID)`와 같은 특정 세그먼트 패턴을 분석하여 메인 스레드를 자동으로 선택해주는 기능을 추가하겠습니다.

## Proposed Changes

### [Component Name]
#### [MODIFY] [SpeedScopeParser.worker.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/workers/SpeedScopeParser.worker.ts)
- `mainThreadPatterns`에 `process32` 키워드 추가
- 프로파일 이름뿐만 아니라, 루트 세그먼트(lane 0)의 이름을 검사하는 로직 추가
- `Process32 Process(PID)` 패턴이 발견되면 해당 프로파일을 메인 스레드 후보로 선정

## Verification Plan

### Automated Tests
- `/tmp/test_speedscope_detection.ts` 파일을 생성하여, 다양한 패턴의 Speedscope JSON 데이터를 모의로 생성하고 메인 스레드 감지 로직이 정확히 동작하는지 검증합니다.
- 실행 명령어: `npx ts-node /tmp/test_speedscope_detection.ts`

### Manual Verification
- 형님께서 가지고 계신 `Process32 Process(1640)` 세그먼트가 포함된 Speedscope JSON 파일을 로드했을 때, 해당 스레드가 자동으로 선택되는지 확인 부탁드립니다.

---
<button id="proceed">Proceed</button>
