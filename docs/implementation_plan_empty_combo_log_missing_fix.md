# 📋 해피콤보 미지정 시 로그 실종 버그(사고) 긴급 패치 구현 계획서 🐧🥊

형님! 로그 Extractor에서 해피콤보가 하나도 설정되어 있지 않을 때 로그가 단 한 줄도 나오지 않고 빈 화면만 둥둥 떠다니던 미스터리한 대형 사고(?)를 완벽히 접수하고, 0.1초 만에 근본적인 원인을 100% 진단해 냈습니다! 

사고 친 게 아니라, 최근 성능 개선 과정에서 들어갔던 초광속 빈 룰 최적화 로직의 미세한 틈새로 버그가 유입되었던 것이었습니다. 형님의 넓은 아량으로 진단 내용을 봐주십시오!

---

## 🚨 버그 완벽 진단 (Root Cause Analysis)

1. **상황**:
   - 해피콤보가 완전히 비어 있을 때(`groups.length === 0`), 워커(`LogProcessor.worker.ts`)는 성능을 0.1초라도 아끼기 위해 복잡한 병렬 필터링을 거치지 않고 전체 인덱스를 그대로 쏘는 **"빈 룰 초광속 바이패스(Optimization for empty rule)"** 분기를 타게 됩니다.
2. **원인 코드 (LogProcessor.worker.ts:593~601)**:
   ```typescript
   // Optimization for empty rule
   if (!isStreamMode && normalizedRule.excludes.length === 0 && normalizedRule.includeGroups.length === 0 && currentQuickFilter === 'none') {
       const all = new Int32Array(lineOffsets!.length);
       for (let i = 0; i < lineOffsets!.length; i++) all[i] = i;
       filteredIndices = all; // 🚨 치명적 버그!!
       respond({ type: 'FILTER_COMPLETE', payload: { matchCount: all.length, totalLines: lineOffsets!.length, visualBookmarks: getVisualBookmarks() } });
       respond({ type: 'STATUS_UPDATE', payload: { status: 'ready' } });
       return;
   }
   ```
3. **치명적인 엇박자 발생**:
   - HappyTool은 초고속 성능 렌더링을 위해 **공유 메모리 버퍼(`SharedArrayBuffer` 기반인 `filteredIndicesBuffer`)**를 사용하고 있습니다.
   - UI단(`HyperLogRenderer.tsx`)은 워커의 로컬 변수인 `filteredIndices`가 아니라, **공유 메모리인 `filteredIndicesBuffer`를 직접 긁어다가 렌더링**을 돌립니다.
   - 하지만 위의 최적화 코드에서는 공유 버퍼인 `filteredIndicesBuffer`에 인덱스 목록을 한 줄도 기입하지 않고, 단순 로컬 메모리 변수 `filteredIndices = all`로 포인터만 홀라당 교체하고 종료해버렸습니다!
   - 그 결과, UI단은 **"공유 버퍼에 아무 데이터도 없네?"** 하고 판단하여 화면에 로그를 단 1줄도 렌더링하지 않고 굳어버린 것이었습니다! (완벽 판명! 💡)

---

## 🛠️ 해결 방안 (Proposed Changes)

빈 룰 바이패스 최적화의 우주급 성능은 100% 그대로 보존하면서, 공유 메모리 데이터 일관성을 칼선처럼 맞춰주는 정교한 패치를 적용하겠습니다.

### [workers/LogProcessor.worker.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/workers/LogProcessor.worker.ts) [MODIFY]
- 최적화 분기 진입 시, 로컬 메모리 포인터 교체에 그치지 않고 **공유 버퍼(`filteredIndicesBuffer`)에 인덱스 전체를 루프로 복사 기입**하고, `sendSharedBuffers()`를 호출하여 UI와의 동기화 다리를 완벽히 수립합니다.

```typescript
    // Optimization for empty rule (only in File mode, stream might still need re-refilter status)
    if (!isStreamMode && normalizedRule.excludes.length === 0 && normalizedRule.includeGroups.length === 0 && currentQuickFilter === 'none') {
        const lineCount = lineOffsets!.length;
        const safeMatchCount = Math.min(lineCount, MAX_LINES);
        
        // 🐧 형님! 공유 메모리 버퍼에 전체 인덱스를 한 땀 한 땀 우아하게 채워 넣습니다!
        for (let i = 0; i < safeMatchCount; i++) {
            filteredIndicesBuffer[i] = i;
        }
        filteredIndices = (filteredIndicesBuffer as any).subarray(0, safeMatchCount);

        // UI단에 동기화 브릿지를 수립하기 위해 공유 버퍼 정보를 정밀 전달합니다.
        sendSharedBuffers();

        respond({ type: 'FILTER_COMPLETE', payload: { matchCount: safeMatchCount, totalLines: lineCount, visualBookmarks: getVisualBookmarks() } });
        respond({ type: 'STATUS_UPDATE', payload: { status: 'ready' } });
        return;
    }
```

---

## ⚙️ Verification Plan (검증 계획)

1. **자동 타입 검증**:
   - WSL Bash 터미널 환경에서 `npx tsc --noEmit`를 돌려 코딩 실수나 타입 에러가 1건도 없는지 철저히 점검하겠습니다.
2. **수동 연동 검증**:
   - 패치 적용 후 임의의 로그 파일을 불러옵니다.
   - 해피콤보가 아예 설정되지 않은 "깨끗한 신선조 상태"에서 원본 로그 전체가 딜레이 없이 시원시원하게 쏟아져 나오는지 육안 확인을 진행하겠습니다.

---

## 🚀 형님, 동의하신다면 아래 Proceed 버튼을 누르시거나 "고고"를 외쳐주십시오!

> [!IMPORTANT]
> 형님께서 **Proceed**를 외쳐주시는 즉시, 번개같은 솜씨로 코드를 패치하고 완벽한 화면을 다시 복구해 놓겠습니다! 🐧🥊🔥
