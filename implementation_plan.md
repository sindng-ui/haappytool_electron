# 성능 분석 Pass Rate 계산 오류 수정 계획서

형님, 성능 분석 대시보드에서 Pass Rate가 100%로 잘못 표시되는 문제를 확인했습니다. 65개의 Fail(Slow Ops)이 있음에도 불구하고 100%로 뜨는 것은 계산 로직이나 데이터 연동에 문제가 있다는 뜻입니다.

## 원인 분석
1. **임계값 비교 연산자 불일치**: `utils/perfAnalysis.ts`에서는 `>`를 사용하고, 다른 곳에서는 `>=`를 사용하여 경계값에서 혼선이 있을 수 있습니다.
2. **Pass Count 계산 로직 점검**: 워커에서 `passCount`와 `failCount`를 계산할 때, 전체 세그먼트 수와 합산이 맞지 않을 가능성이 있습니다.
3. **대시보드 UI 계산식 보강**: 대시보드 UI에서 `result.passCount`에만 의존하지 않고, 전체 세그먼트 대비 실패 건수를 직접 계산하여 더 정확한 수치를 보여주도록 수정하겠습니다.

## 수정 계획
1. **`utils/perfAnalysis.ts` 수정**: 
   - 성능 상태 판정 시 `>`를 `>=`로 변경하여 일관성을 맞춥니다.
2. **`workers/LogProcessor.worker.ts` 수정**:
   - `passCount`와 `failCount` 계산 시 필터링 로직을 더 명확히 하고, 필요시 합계 검증 로직을 추가합니다.
3. **`workers/PerfTool.worker.ts` 수정**:
   - 분석 결과 생성 시 `passCount`와 `failCount`가 정확히 세그먼트 총합과 일치하는지 확인합니다.
4. **`components/LogViewer/PerfDashboard.tsx` 수정**:
   - Pass Rate 표시부를 `((전체 - 실패) / 전체)` 방식으로 계산하여, 데이터 불일치가 있더라도 정확한 합격률이 표시되도록 보강합니다.

형님, 이대로 진행할까요? 'proceed'라고 말씀해 주시면 바로 작업 시작하겠습니다!
