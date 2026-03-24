# Speedscope 메인 스레드 탐지 개선 계획 🐧

형님! Speedscope 플러그인에서 메인 스레드를 더 똑똑하게 찾을 수 있도록 개선하겠습니다. 제보해주신 `Process32 Process(PID)(TID)` 패턴을 적극 활용하여, PID와 TID가 같은 스레드(보통 메인 스레드죠!)를 우선적으로 찾도록 로직을 보강하겠습니다.

## 1. 개요
현재 `detectMainThread` 로직이 특정 환경의 Speedscope JSON에서 메인 스레드를 제대로 식별하지 못하는 문제를 해결합니다.

## 2. 주요 변경 사항

### [[Speedscope Utils]]
- **대상 파일**: [speedScopeUtils.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/utils/speedScopeUtils.ts)
- **변경 내용**:
  - `procRegex`를 더 명확하게 개선하여 `Process(PID)(TID)` 패턴을 완벽히 지원합니다.
  - 최상단 세그먼트(Lane 0)에서 추출한 PID와 TID가 동일한 경우, 해당 스레드를 메인 스레드로 강력하게 추정합니다.
  - 기존 코드의 `pidIdx` 검색 부분에서 발견된 괄호 오타(논리 오류)를 수정합니다.
  - `mainThreadPatterns`에 'process' 관련 키워드가 너무 포괄적일 수 있으므로 검토 및 조정합니다.

## 3. 검증 계획

### 자동화 테스트
- `test/utils/speedScopeUtils.test.ts` (신규 생성 가능성 있음) 파일을 통해 다양한 패턴의 Speedscope 데이터로 메인 스레드가 제대로 잡히는지 확인합니다.
- 특히 형님이 주신 `Process32 Process(1492)(1492)` 패턴을 포함한 더미 데이터를 사용하여 검증합니다.

### 수동 검증
- 실제 문제가 발생했던 Speedscope JSON 파일을 로드하여 메인 스레드가 자동으로 선택되는지 확인합니다.

---

형님, 이 계획대로 진행해도 될까요? OK 하시면 바로 코드 수정 들어가겠습니다! 🚀
<button>proceed</button>
