# Timeline 중복 세그먼트 제거 계획

## 문제 원인 분석
현재 Analyze Diff 기능은 두 가지 방식으로 세그먼트(Interval)를 추출합니다:
1. **Alias Sequence Matching (Part 2)**: Happy Combo의 Alias를 기반으로 엄격하게 구간을 나눕니다. (`isAliasInterval: true`)
2. **General Interval Analysis (Part 3)**: 로그의 시그니처 변화를 감지하여 유의미한 구간을 추출합니다. (`isAliasInterval: false`)

Alias가 지정된 로그는 '유의미한 로그'로도 분류되기 때문에, 동일한 로그 구간이 두 로직 모두에서 검출될 수 있습니다. UI 필터링 조건(`r.leftAvgDelta > 0 || r.isAliasInterval`)을 둘 다 통과할 경우, 사용자에게는 거의 동일해 보이는(혹은 완전히 동일한) 세그먼트가 두 번 표시됩니다.

또한, Alias 매칭 로직 내부적으로도 동일한 구간에 대해 중복 매칭이 발생할 가능성이 있는지 검증하고, 시각적으로 동일한 범위(`leftPrevLineNum` ~ `leftLineNum`, `rightPrevLineNum` ~ `rightLineNum`)를 가리키는 중복 결과를 제거해야 합니다.

## 제안하는 변경 사항

### [Worker]
#### [MODIFY] [SplitAnalysis.worker.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/workers/SplitAnalysis.worker.ts)
- `results` 배열을 생성한 후, 최종 반환 전에 **시각적 범위 기반의 중복 제거(Deduplication)** 로직을 추가합니다.
- 동일한 좌/우측 시작/종료 인덱스를 가진 세그먼트가 존재할 경우, `isAliasInterval: true`인 항목을 우선적으로 남기고 나머지는 제거합니다.
- `key`가 다르더라도 가리키는 로그 범위가 같으면 사용자에게는 중복으로 느껴지므로 이를 차단합니다.

## 검증 계획

### 자동화 테스트
- `test/workers/SegmentSync.test.ts`에 중복 발생 케이스를 추가하여, 중복 제거 로직이 정상 작동하는지 확인합니다.

### 수동 확인
- 형님께서 공유해주신 로그 환경에서 다시 분석을 실행하여, 중복된 Indigo(Zap) 박스가 사라졌는지 확인합니다.

[proceed]
