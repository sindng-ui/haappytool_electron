# 🐧 세그먼트 분석 개선 계획: 1줄 알리아스 포함하기

형님! 분석 기능에서 1줄짜리 알리아스 로그도 세그먼트로 보고 싶으시다는 요청을 받았습니다. 
현재는 2줄 이상(시작과 끝)이 있을 때만 인터벌(Segment)로 계산하고 있었는데, 1줄만 있어도 당당하게 분석 결과에 나올 수 있도록 수술을 시작해 보겠습니다!

## 🎯 목표
- 해피콤보 알리아스가 매칭된 로그가 1줄만 있어도 세그먼트로 분석 결과에 포함.
- 1줄짜리 알리아스 로그는 기존의 파일명/함수명/라인번호 규칙에 얽매이지 않고 독립적인 세그먼트로 처리.
- 분석 결과(Analyze Diff)에서 왼쪽/오른쪽 로그의 발생 여부를 정확히 비교.

## 🛠️ 수정 사항

### 1. `workers/SplitAnalysisUtils.ts` 수정
- `computeMetricsFromMetadata` 함수 내의 알리아스 처리 로직을 수정하여 첫 번째 매칭 시점부터 즉시 메체릭(Interval)에 추가합니다.
- `addAliasMetric` 함수를 보강하여 `directCount` 필드를 추가하고, 1줄짜리 로그(시작=끝)인 경우에도 메체릭이 유효하도록 설정합니다.

### 2. `workers/SplitAnalysis.worker.ts` 확인 (검증)
- 워커에서 `directCount`가 0보다 큰 경우 노이즈 필터링을 통과하므로, `addAliasMetric`에서 `directCount: 1`을 명시적으로 넣어주면 분석 결과에 정상적으로 포함됩니다.

## 📝 상세 변경 내용 (Draft)

### `SplitAnalysisUtils.ts`
```typescript
// computeMetricsFromMetadata 함수 내부
if (item.alias) {
    if (!state.aliasFirstMatch) state.aliasFirstMatch = {};
    
    // 첫 번째 매칭이라도 일단 세그먼트로 등록 (1줄짜리 대응)
    if (!state.aliasFirstMatch[item.alias]) {
        state.aliasFirstMatch[item.alias] = item;
    }
    
    // 🐧⚡ 1줄이라도 세그먼트로 추가하고, 2줄 이상이 되면 구간이 업데이트됩니다.
    const firstMatch = state.aliasFirstMatch[item.alias];
    const key = `[Alias] ${item.alias}`;
    
    addAliasMetric(metrics, key, firstMatch, item, state.metricsCount);
}
```

```typescript
// addAliasMetric 함수 내부
function addAliasMetric(...) {
    // ... 기존 로직 ...
    metrics[key] = {
        count: 1,
        directCount: 1, // 🐧⚡ 워커 필터링 통과를 위해 추가!
        // ... 나머지 필드 ...
        fileName: last.fileName || `[Alias]`,
        functionName: last.functionName || last.alias || '',
        // ...
    };
}
```

## 📅 향후 일정
1. 상기 계획에 따라 `workers/SplitAnalysisUtils.ts`를 수정합니다.
2. `APP_MAP.md`에 변경 사항을 업데이트합니다.
3. 형님께 완료 보고를 올립니다!

형님, 이 계획대로 진행해도 될까요? 🐧✨

<button id="proceed">proceed</button>
