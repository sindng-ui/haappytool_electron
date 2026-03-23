# Speedscope dotnet trace 감지 유닛 테스트 구축 계획서 🐧

형님! 이전 단계에서 개선한 감지 로직이 미래에도 깨지지 않도록 견고한 유닛 테스트(UT)를 구축하겠습니다. 로직을 별도 유틸리티로 추출하여 유지보수성을 높이고 다양한 `dotnet trace` 시나리오를 검증합니다.

## Proposed Changes

### [Core Infrastructure]
#### [NEW] [speedScopeUtils.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/utils/speedScopeUtils.ts)
- `workers/SpeedScopeParser.worker.ts`에서 감지 로직 및 패턴 정의를 추출하여 공통 유틸리티화
- `detectMainThread(profiles, fileName, allSegments)` 함수 내보내기

#### [MODIFY] [SpeedScopeParser.worker.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/workers/SpeedScopeParser.worker.ts)
- 내부 로직을 `speedScopeUtils.ts` 호출로 대체하여 코드 중복 제거

### [Testing]
#### [NEW] [SpeedScopeParser.worker.test.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/test/workers/SpeedScopeParser.worker.test.ts)
- `vitest`를 사용한 유닛 테스트 작성
- **테크니컬 시나리오**:
    1. **Dotnet Trace Standard**: `Managed Thread (0x...)` 프로파일이 여러 개 있을 때 가장 활발한 스레드 선택 확인
    2. **Priority Check**: 파일명과 일치하는 프로파일이 있는 경우 패턴보다 우선순위가 높은지 확인
    3. **Fallback Logic**: 아무 패턴도 없을 때 가장 샘플이 많은 스레드를 선택하는지 확인
    4. **Legacy Support**: `Process32` 패턴이 루트 세그먼트에 박혀있는 경우 역추적 기능 확인

## Verification Plan

### Automated Tests
- 실행 명령어: `npx vitest test/workers/SpeedScopeParser.worker.test.ts`
- 모든 테스트 케이스가 `PASS` 하는지 확인하고 결과를 `docs/test_result_speedscope_ut.txt`에 기록

---
[Proceed](command:antigravity.proceed)
