# Alias Interval Analysis 고도화 및 버그 수정 계획

형님, 이전 LCS 엔진 백트래킹 수정으로 코어 엔진은 완벽해졌지만, 추가적으로 **Alias Interval Analysis (구간 소요 시간 분석)** 기능에서 발생하는 논리적 충돌을 발견했습니다.

## 문제 원인 (왜 054.xxx로 여전히 점프했는가)

1. **Alias Interval Analysis의 맹목적 매칭**
   - 현재 Alias Interval 기능은 매칭된 Alias들을 바탕으로 무조건 `1번째 구간 ➔ 1번째 구간`, `2번째 구간 ➔ 2번째 구간` 식으로 일대일 하드 매칭을 수행하고 있습니다.
   - `test_startup.log`에서 `OnError`가 여러 번 발생할 때, 중간에 다른 Alias가 없다면 `OnError ➔ OnError` 라는 **단일 Alias 구간**이 만들어집니다.
   - 좌측 로그의 1번째 `OnError ➔ OnError` 발생 위치와 우측 로그의 1번째 발생 위치가 완전히 다른 흐름에 있더라도 (예: 052.760 vs 054.405), UI는 이것을 동일 구간으로 착각하고 묶어버렸습니다. (콘솔에 찍힌 `(#1)` 키워드가 그 증거입니다.)

2. **LCS 엔진과의 역할 충돌**
   - 현재 강력해진 **LCS Sequence Matching (Burst Grouping 포함)** 과 **Global Alias Batch Analysis** 가 이미 동일 로그(`A ➔ A`)의 반복 및 전체 소요 시간을 완벽하게 추적하고 있습니다.
   - 그럼에도 과거에 만들어둔 Alias Interval Analysis 기능이 `A ➔ A` 구간을 억지로 다시 생성하면서, 정교한 LCS 엔진의 결과와 충돌을 일으킨 것입니다.

## Proposed Changes

### [SplitAnalysisUtils.ts]

`computeAliasIntervals` 함수 내에서 연속된 두 Alias가 **완전히 동일한 시그니처(`start.alias === end.alias`)** 일 경우, Interval 생성을 건너뛰도록(skip) 수정합니다.

#### [MODIFY] SplitAnalysisUtils.ts
```typescript
    const getIntervals = (events: AliasEvent[]) => {
        const intervals: { start: AliasEvent; end: AliasEvent; duration: number; sig: string }[] = [];
        for (let i = 0; i < events.length - 1; i++) {
            const start = events[i];
            const end = events[i + 1];
            
            // 🐧⚡ [FIX] 동일명 Alias 반복(A ➔ A)은 Global Batch와 LCS Burst Grouping으로 완벽히 커버되므로
            // N번째 맹목적 매칭 시 엉뚱한 구간이 연결되는 버그를 방지하기 위해 여기서 생성하지 않습니다.
            if (start.alias === end.alias) continue;

            if (start.timestamp && end.timestamp) {
                intervals.push({
                    start,
                    end,
                    duration: end.timestamp - start.timestamp,
                    sig: `${getFormattedEventSig(start)} ➔ ${getFormattedEventSig(end)}`
                });
            }
        }
        return intervals;
    };
```

## 기대 효과 🐧🎯
- `OnError ➔ OnError` 처럼 반복되는 스팸성 Alias들이 억지로 매칭되어 엉뚱한 타임라인으로 점프하는 현상이 영구적으로 사라집니다.
- 반복 Alias 구간의 분석 결과는 이미 `Global Alias Batch Analysis`(오버뷰용)와 `LCS Burst Grouping`(상세 타임라인용)이 완벽하고 안전하게 제공하므로, 유실되는 정보는 전혀 없습니다.
- 오히려 타임라인 리스트에 노이즈 데이터를 줄여주어 가독성이 비약적으로 상승합니다.
