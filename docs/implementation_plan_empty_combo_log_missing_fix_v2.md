# 📋 해피콤보 미지정 시 로그 실종 버그 2차 긴급 패치 구현 계획서 🐧🥊

형님! 보내주신 명확한 에러 시나리오(신규 미션 생성 및 모두 언체크 시 로그 실종)를 바탕으로, 시스템 백그라운드에서 일어나는 미세한 엇박자와 틈새를 100% 포착하여 완벽한 2중 방어막 해결책을 설계했습니다!

---

## 🚨 버그 심층 원인 진단 (Deep Root Cause)

1. **미션 전환 시의 캐시 엇박자**:
   - 신규 미션을 만들면 새로운 빈 룰이 활성화되지만, 이전 미션도 빈 룰 상태였을 경우 필터 해시(`payloadHash`)가 완전히 동일합니다.
   - 이로 인해 UI단(`useLogExtractorLogic.tsx`)이 필터가 바뀌지 않았다고 판단해 워커로 메시지를 쏘는 행위 자체를 생략(`return;`)하면서 화면이 하얗게 굳어버렸습니다.
2. **스트림 제약 및 서브워커 매칭 엇박자**:
   - 기존의 빈 룰 최적화 코드에는 `!isStreamMode` (파일 모드만 지원) 제약이 걸려 있어, 특정 스트림 환경이나 블록 리스트 1개라도 섞여서 최적화 분기를 타지 않고 병렬 필터링(`LogFilterSub.worker.ts`)으로 내려갔을 경우,
   - 빈 룰 상태임에도 서브워커 단에서 groups 매칭 오동작이나 WASM 엔진 오매칭을 타서 결과가 0개로 걸러져 버리는 엇박자가 발생했습니다.

---

## 🛠️ 해결 방안 (Proposed Changes)

빈 룰일 때는 묻지도 따지지도 않고 **원본 로그 전체가 0.0001초 만에 무조건 쏟아져 나오도록** 강력한 2중 방어망을 구축하겠습니다!

### 1) [hooks/useLogExtractorLogic.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/hooks/useLogExtractorLogic.tsx) [MODIFIED - 완료]
- 미션(`selectedRuleId`)이 변경되거나 신규 미션이 생성되는 즉시 이전 해시 캐시를 강제로 비워주어, 아무리 둘 다 빈 룰이더라도 **100% 무조건 워커로 필터를 쏘도록 연동 고리를 수립**해 두었습니다!

### 2) [workers/LogProcessor.worker.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/workers/LogProcessor.worker.ts) [MODIFY]
- 빈 룰 최적화 분기에서 `!isStreamMode` 제약을 과감히 제거하여, **파일 모드와 스트림 모드 가리지 않고 빈 룰일 때는 무조건 초광속 바이패스로 전체 메모리를 채우고 종료**하게 만듭니다.

```typescript
    // 🐧 형님! 스트림/로컬 가리지 않고 빈 룰일 때는 무조건 초광속 바이패스로 전체 로그가 나오게 만듭니다!
    if (normalizedRule.excludes.length === 0 && normalizedRule.includeGroups.length === 0 && currentQuickFilter === 'none') {
        const lineCount = lineOffsets ? lineOffsets.length : (isStreamMode ? streamLineCount : 0);
        const safeMatchCount = Math.min(lineCount, MAX_LINES);
        
        console.log(`[Worker-Debug] 🚀 Dynamic Empty rule bypass TRIGGERED! safeMatchCount: ${safeMatchCount}, totalLines: ${lineCount}`);
        
        for (let i = 0; i < safeMatchCount; i++) {
            filteredIndicesBuffer[i] = i;
        }
        filteredIndices = (filteredIndicesBuffer as any).subarray(0, safeMatchCount);

        sendSharedBuffers();

        respond({ type: 'FILTER_COMPLETE', payload: { matchCount: safeMatchCount, totalLines: lineCount, visualBookmarks: getVisualBookmarks() } });
        respond({ type: 'STATUS_UPDATE', payload: { status: 'ready' } });
        return;
    }
```

### 3) [utils/logFiltering.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/utils/logFiltering.ts) [MODIFY]
- 병렬 서브워커 필터링으로 내려갔을 경우를 대비하여, `checkIsMatch` 매칭 함수 초입부에 **해피콤보와 블록리스트가 모두 비어있을 때는 무조건 0.0001초 만에 `true` (무조건 통과)를 쏘아 올리는 초강력 방어 가드**를 장착합니다!

```typescript
    if (!rule) return true;

    // 🐧 형님! 콤보나 블록리스트가 완전히 없는 빈 룰 상태라면 묻지도 따지지도 않고 무조건 true 패스합니다!
    const hasHappy = rule.includeGroups && rule.includeGroups.length > 0;
    const hasBlock = rule.excludes && rule.excludes.length > 0;
    if (!hasHappy && !hasBlock && quickFilter === 'none') {
        return true;
    }
```

---

## ⚙️ Verification Plan (검증 계획)

1. **자동 타입 및 빌드 검사**:
   - `npx tsc --noEmit`를 실행해 컴파일 에러 유무를 다시 철저히 점검하겠습니다.
2. **시나리오 수동 입증**:
   - 형님이 말씀해주신 3단계 재현 시나리오(로그 열고 신규 미션 만들기 -> 모두 언체크하기)를 똑같이 수행하여 전체 원본 로그가 깨끗하고 개방감 있게 쏟아져 나오는지 입증하겠습니다!

---

## 🚀 형님, 동의하신다면 다시 한 번 "고고"를 외쳐주십시오!

> [!IMPORTANT]
> 형님께서 **Go**를 선언해 주시는 즉시, 번개같은 솜씨로 워커와 필터 유틸에 2중 방어망 패치를 완료해 놓겠습니다! 🐧🥊🔥
