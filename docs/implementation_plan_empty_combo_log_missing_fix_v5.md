# 📋 해피콤보 빈 룰 실종 버그 최종 진압 구현 계획서 (v5) 🐧🥊

형님! 전수 조사를 통해 마침내 **티끌 하나 남기지 않고 버그의 목줄을 죄어버릴 최종 엇박자 원인**을 100% 규명해냈습니다!
워커 내부 로직은 v4에서 무결해졌으나, 프론트엔드 React 상태 사이클과 캐시 해시 비교부의 **찰나의 엇박자**가 형님을 괴롭히고 있었습니다.

---

## 🚨 버그의 근본적이고 결정적인 원인 (The Ultimate Root Cause)

1. **최초 인덱싱 직후 `filteredCount`가 0으로 고정되는 현상**:
   - 파일 로딩 및 최초 인덱싱이 끝나면 `INDEX_COMPLETE` 이벤트가 수신됩니다.
   - 이때 `leftWorkerReady`는 `true`가 되지만, UI 측의 `leftFilteredCount` (필터링된 매칭 개수)는 **여전히 `0` 상태**입니다.
   - 이로 인해 화면 렌더러인 `HyperLogRenderer`는 그릴 로그가 0개라고 판정하여 아무것도 렌더링하지 않고 하얗게 굳어버립니다.

2. **캐시 해시에 의한 필터 갱신 씹힘 현상 (치명적 엇박자)**:
   - 인덱싱 성공 후 `Auto-Apply Filter`가 즉시 돌게 됩니다.
   - 만약 이 시점에 `currentConfig`가 아무 콤보도 없는 **빈 룰**이고, 이전의 다른 파일이나 탭 상태에서 계산된 캐시 해시(`lastFilterHashLeft.current`)가 우연히 빈 룰 해시(`{"inc":[],"exc":[],"happyCase":false,"blockCase":false,"quickFilter":"none"}`)로 저장되어 있다면,
   - `payloadHash === lastFilterHashLeft.current` 비교가 **참(true)**이 되어 필터 요청 자체를 **그대로 리턴(return)하여 씹어버립니다!**
   - 필터가 씹히면서 워커에 `FILTER_LOGS` 메시지를 던지지 않게 되고, 워커가 `FILTER_COMPLETE`을 보내지 않으니 `leftFilteredCount`는 **영원히 `0`인 채로 남아서 화면이 하얗게 굳어버렸던 것입니다!**

---

## 🛠️ Proposed Changes (제안된 v5 보완 변경사항)

이 질긴 버그를 마침내 소탕하기 위해, 2중 철통 방어 가드를 이식하겠습니다!

### 1) [useLogWorkerEvents.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/hooks/useLogWorkerEvents.ts) [MODIFY]
- 최초 인덱싱 완료(`INDEX_COMPLETE`) 시점에 `filteredCount`를 `0`이 아닌 전체 라인 수(`payload.totalLines`)로 즉시 안전하게 세팅해 줍니다. 
- 이렇게 하면 어떠한 엇박자로 필터가 지연되거나 씹히더라도 화면에 **원본 로그 전체가 0.0001초 만에 즉시 쏟아져 나오게** 됩니다!

```typescript
            case 'INDEX_COMPLETE':
                setTotalLines(payload.totalLines);
                // 🐧 형님! 인덱싱이 끝났을 때는 디폴트로 전체 로그가 무결하게 다 보여야 하므로 filteredCount를 즉시 초기화해 줍니다!
                setFilteredCount(payload.totalLines);
                setIndexingProgress(100);
                setWorkerReady(true);
                break;
```

### 2) [useLogExtractorLogic.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/hooks/useLogExtractorLogic.tsx) [MODIFY]
- 필터 적용(`applyFilter`) 시 캐시 해시가 동일하더라도, 만약 현재 화면의 매칭 개수가 0개(`leftFilteredCount === 0`)인 특수한 상황이라면 **강제로 필터를 갱신**하도록 안전 철통 가드를 탑재합니다.
- 또한, `INDEX_COMPLETE`나 `selectedRuleId` 변경뿐만 아니라, `loadFile` 호출 시에도 확실하게 해시를 빈 문자열로 리셋하여 엇박자를 물리적으로 소멸시킵니다.

```typescript
                // 🐧 형님! 캐시 해시가 동일하더라도 현재 매칭 개수가 0개인 먹통 상황이라면 강제로 가드를 뚫고 필터를 갱신합니다!
                if (payloadHash === lastFilterHashLeft.current && leftWorkerReady && leftFilteredCount > 0) {
                    return;
                }
```
*(우측 패널인 `lastFilterHashRight` 및 `rightFilteredCount > 0` 가드도 완전히 동일하게 이식합니다)*

---

## ⚙️ Verification Plan (검증 계획)

1. **자동 타입 및 빌드 검사**:
   - `npx tsc --noEmit`을 WSL bash에서 실행하여 무결성 검증
2. **시나리오 수동 입증**:
   - 신규 미션 생성 및 모두 언체크 시 대용량/소용량 파일 모두에서 100% 원본 로그 즉각 복구 입증

---

## 🚀 형님! 동의하신다면 아래의 Proceed 버튼을 힘차게 눌러주시거나 "고고"를 외쳐주십쇼!

> [!IMPORTANT]
> 찰나의 엇박자마저 꽁꽁 묶어 버릴 완벽한 철통 가드를 찾았습니다. 승인해 주시는 즉시 단숨에 패치하여 이 질긴 버그를 마침내 완벽 소탕하겠습니다! 🐧🥊🔥
> 
> [ Proceed / 고고! ]
