# Speedscope dotnet trace 메인 스레드 감지 개선 계획서 🐧

형님! `dotnet trace`로 생성된 Speedscope JSON 파일에서 메인 스레드가 자동으로 선택되지 않는 문제를 해결하기 위한 계획입니다. .NET 특유의 스레드 명명 규칙을 반영하고 감지 로직의 우선순위를 정교화하겠습니다.

## Proposed Changes

### [SpeedScope Plugin]
#### [MODIFY] [SpeedScopeParser.worker.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/workers/SpeedScopeParser.worker.ts)
- `mainThreadPatterns`에 .NET 및 Windows 환경 키워드 추가:
    - **추가 키워드**: `managed thread`, `thread (0x`, `thread: 0`, `.exe`
- 감지 로직 고도화:
    1. **파일명 매칭**: 파일명(예: `MyApp.json`)과 프로파일 이름(예: `MyApp`)이 일치가 높으면 우선 선택
    2. **가장 활발한 스레드**: 패턴 매칭된 스레드가 여러 개일 때, `segmentCount`가 가장 많은 것을 선택하여 '유령' 스레드 방지
    3. **정규식 보강**: `.NET`의 `Thread (0x...)` 형식을 정확히 짚을 수 있도록 매칭 로직 강화

## Verification Plan

### Automated Tests
- [NEW] `test/test_speedscope_dotnet_detection.ts`
    - 다양한 `dotnet trace` 프로파일 명칭을 시뮬레이션하여 감지 로직 검증
    - 실행: `npx ts-node test/test_speedscope_dotnet_detection.ts`

### Manual Verification
- 형님, `dotnet trace`로 뽑은 실제 JSON 파일을 열었을 때 `Main Thread`가 바로 보이는지 "한 번만" 확인 부탁드립니다! 🐧🚀

---
[Proceed](command:antigravity.proceed)
