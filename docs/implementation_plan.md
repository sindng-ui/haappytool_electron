# 🏆 [구현 계획서 v14] 앱 리로드 시 2회 꿈벅거림(깜빡임) 엇박자 완벽 소탕 계획서 펭펭! 🐧🥊

형님! 앱을 새로고침(Ctrl+R)하거나 파일을 처음 드롭할 때 화면이 원본 노출 -> 로딩창 -> 필터 노출 순으로 "꿈벅꿈벅" 2번 깜빡이던 근본 엇박자 진범을 완전히 색출했습니다!

## 1. 🔍 원인 분석 (Root Cause)

1. **인덱싱 완료 (`INDEX_COMPLETE`)**:
   - 파일 인덱싱이 끝나면 `useLogWorkerEvents.ts`에서 즉시 `setWorkerReady(true)`를 호출하여 로딩창을 지웁니다.
   - 이때 화면에 필터링되지 않은 원본 로그(예: 5줄 전체)가 먼저 1차 노출됩니다.
2. **applyFilter 디바운스 타이머 (150ms 지연)**:
   - 인덱싱 완료 시점에 캐시가 비워진 후 `applyFilter`가 `setTimeout(applyFilter, 150)`으로 지연 트리거됩니다.
   - 150ms가 지나 타이머가 풀리면 `applyFilter` 본문이 기동되면서 적용할 룰(예: 키워드 `a`)이 존재하므로 다시 `setLeftWorkerReady(false)`를 호출하여 **로딩창이 2차로 뜨게 됩니다(꿈벅 1)**.
3. **필터링 완료 (`FILTER_COMPLETE`)**:
   - 워커가 필터를 끝내고 `FILTER_COMPLETE`를 쏘면 다시 `setWorkerReady(true)`를 선언하여 완성된 매칭 로그(4줄)를 보여줍니다**(꿈벅 2)**.

이 `ready=true(인덱스완료) -> ready=false(필터시작) -> ready=true(필터완료)`로 이어지는 **상태의 핑퐁 지연**이 2회 깜빡임의 근본 원인이었습니다!

---

## 2. 🛠️ 해결 설계 (Proposed Changes)

최초 필터 기동 시(캐시가 완전히 비어있는 상황)에는 굳이 150ms의 디바운스 숨고르기 지연을 줄 필요가 전혀 없습니다!

### 1) [useLogExtractorLogic.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/hooks/useLogExtractorLogic.tsx) 내 최초 applyFilter delay를 `0`으로 격하
- `applyFilter` 타이머 구동부에서 `lastFilterHash` 캐시가 완전히 비어있는 상황(`isInitialApply = lastFilterHash.current === ''`)을 감지합니다.
- 최초 기동 시에는 딜레이를 **0ms**로 즉시 디스패치합니다:
```typescript
const isInitialApply = lastFilterHashLeft.current === '';
const delay = isInitialApply ? 0 : 150;
const timer = setTimeout(applyFilter, delay);
return () => clearTimeout(timer);
```
- delay가 0ms가 되면 ready=true가 선언되는 즉시 동기식 tick으로 `applyFilter`가 작동하여, 원본 로그가 화면에 그려지기도 전에 즉각 `setLeftWorkerReady(false)`로 원복되어 워커에 `FILTER_LOGS`가 전송됩니다.
- 브라우저가 원본 로그를 렌더링할 틈을 주지 않고 로딩창이 쭉 유지되다가, 필터가 끝난 순간 **단 한 번에 완성된 로그를 노출**하여 꿈벅거림을 완벽 종식시킵니다!

---

## 3. 🧪 검증 계획 (Verification Plan)

### 수동 검증
1. 앱 기동 후 로그 파일을 하나 엽니다.
2. 특정 해피콤보(예: `a`)를 등록한 후 `Ctrl+R`로 앱을 새로고침합니다.
3. 화면이 "꿈벅꿈벅" 2번 깜빡이지 않고, 로딩창이 쭉 부드럽게 유지되다가 필터링된 완성 결과(4줄)가 **단 한 번**에 우아하게 노출되는지 확인합니다.

---

형님! 이 정교한 소탕 설계안을 승인해 주시고, "고고!" 혹은 "거"라고 한번만 적어주시면 즉각 코딩을 시작해 2회 깜빡임 jank를 즉사시키겠습니다! 펭펭! 🐧🏆✨

[PROCEED_BUTTON: 고고!]
