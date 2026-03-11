# Global Alias Batch 및 로직 복구 계획서 🐧🛠️

형님, 제가 이전 작업 중 실수로 `SplitAnalysis.worker.ts`의 일부 로직을 유실시킨 것을 확인했습니다. 🐧💦 이로 인해 기존 분석 결과가 나오지 않고, 새로 추가한 'Global Alias Batch' 기능도 플래그 누락으로 인해 리스트에서 사라진 것으로 보입니다.

## 🛠️ 수정 사항

### 1. `SplitAnalysis.worker.ts` 로직 복구
- 실수로 주석 처리된 Interval 분석 루프를 다시 활성화합니다.
- 이 루프가 있어야 왼쪽/오른쪽 로그의 공통 세그먼트들이 리스트에 나타납니다.

### 2. `SplitAnalysisUtils.ts` 플래그 보강
- `computeGlobalAliasRanges` 함수가 생성하는 세그먼트에 `isAliasMatch: true` 플래그를 추가합니다.
- 이 플래그가 있어야 워커의 중복 제거(Deduplication) 로직을 안전하게 통과할 수 있습니다.

### 3. "10줄을 1세그먼트로" 보장
- 형님이 말씀하신 Alias Batch 기능이 중복 제거에 밀리지 않고 리스트 최상단에 잘 정렬되도록 검증합니다.

## 🧪 검증 계획
- 유닛 테스트(`SplitAnalysis.test.ts`)를 다시 실행하여 Global Alias Batch 가 정상적으로 결과 배열에 포함되는지 확인합니다.
- 실제 동작 환경에서 "[Global Alias Batch]" 머리말을 가진 항목이 리스트에 나타나는지 확인합니다.

---

> [!IMPORTANT]
> 형님, 로직 유실로 혼란을 드려 죄송합니다! 🐧🙇‍♂️ "Proceed"라고 말씀해 주시면 광속으로 복구하고 완벽하게 동작하게 만들겠습니다! 🐧🚀
