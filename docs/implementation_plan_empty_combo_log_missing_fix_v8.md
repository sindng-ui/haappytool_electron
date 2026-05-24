# 📋 [구현 계획서] 빈 룰 원본 로그 실종 버그 종결 및 깜빡임 제로 가드 수립 (v8) 펭펭! 🐧🥊

형님! 콤보가 완전히 비어있거나 신규 미션 생성 시, 그리고 탭을 전환하거나 파일을 새로 열었을 때 로그가 아예 나오지 않던 먹통 버그의 결정적 원인(Root Cause)을 전수조사하여 마침내 검거했습니다! 

기존 v7 패치에서 깜빡임을 잡기 위해 `FILTER_LOGS` 메시지 전송 자체를 통째로 막아버렸던(Early Return) 조치가, 워커와의 데이터 동기화(`SharedArrayBuffer` 및 `FILTER_COMPLETE`)를 완전히 끊어버려 로그 실종 먹통 사태를 초래하고 있었습니다.

이에 따라, **"워커의 정상적인 빈 룰 초광속 패스는 유지하되, 로딩창 강등(WorkerReady=false)만 지능적으로 차단하여 깜빡임과 로그 실종을 단 한 방에 다 잡아내는"** 궁극의 v8 해결책을 제출합니다!

---

## 🛠️ 실질적인 변경 계획 (Proposed Changes)

### 1) [useLogExtractorLogic.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/hooks/useLogExtractorLogic.tsx) [MODIFY]

#### 🅰️ Left Panel 필터링 로직 수정 (L586~L607 부근)
- **기존 (v7)**: 빈 룰일 때 `FILTER_LOGS` 메시지 전송 자체를 얼리 리턴으로 차단.
- **수정 (v8)**: 
  - 얼리 리턴 차단막을 과감하게 걷어내어 워커로의 정상적인 통신을 보장합니다.
  - 대신, 빈 룰(`isEmptyRule`) 상태라면 **`setLeftWorkerReady(false)` 호출만 우회**시켜, 화면이 빈 로딩창으로 강등되는 것을 완벽하게 막습니다!

```typescript
// 🐧🎯 v8 초정밀 깜빡임 제로 & 동기화 가드 수립
const isEmptyRule = effectiveIncludes.length === 0 && effectiveExcludes.length === 0 && quickFilter === 'none';

if (payloadHash === lastFilterHashLeft.current && leftWorkerReady) {
    return;
}
lastFilterHashLeft.current = payloadHash;

if (!isEmptyRule) {
    // 🐧 실질 필터가 존재할 때만 로딩 상태로 우아하게 강등시켜 엇박자 잔상을 막습니다!
    setLeftWorkerReady(false);
}
setLeftSegmentIndex(0);
leftViewerRef.current?.scrollTo(0);
if (setClearCacheTick) setClearCacheTick(prev => prev + 1);

console.log('[useLog-Left] FILTER_LOGS dispatch. isEmptyRule:', isEmptyRule);
leftWorkerRef.current?.postMessage({
    type: 'FILTER_LOGS',
    payload: { ...currentConfig, includeGroups: combinedGroups, excludes: combinedExcludes, quickFilter }
});
```

#### 🅱️ Right Panel 필터링 로직 수정 (L649~L668 부근)
- 우측 패널(Right) 필터링에 대해서도 좌측과 완벽하게 100% 동일한 대칭 가드(`isEmptyRule` 체크 및 `setRightWorkerReady(false)` 분기 처리)를 적용합니다.

---

## 📊 기대 효과 (Expected Benefits)

1. **로그 실종 버그의 완벽한 박멸**:
   - 파일 열기, 탭 전환, 파일 닫고 다시 열기 등 어떤 상황에서도 워커에 `FILTER_LOGS`가 투명하게 들어가 바이패스 및 공유 버퍼 동기화(`sendSharedBuffers`)를 무조건 완료하므로, 로그가 먹통이 되어 실종되던 치명적인 리그레션이 원천 봉쇄됩니다!
2. **단 1프레임의 깜빡임도 없는 미려함**:
   - 빈 룰일 때는 `setWorkerReady(false)`를 호출하지 않아 화면이 로딩창으로 떨어지지 않습니다. 
   - 동시에 워커는 0.0001초 만에 바이패스 처리를 완료하고 즉시 화면 데이터를 갱신하므로, 사라졌다 나타나는 jank 현상이 완벽하게 0%로 수렴합니다!

---

## 🏎️ 검증 계획 (Verification Plan)

### 1) 자동 빌드 검증
- WSL Bash 환경에서 `npx tsc --noEmit` 명령을 신나게 실행하여 타입 호환성 및 빌드 무결성을 최종 확인합니다.

### 2) 수동 UX 전수 검증
- **신규 미션 생성**: 콤보가 전혀 없는 빈 미션을 만들었을 때 즉시 원본 전체 로그가 쏟아져 나오는지 확인.
- **파일 재오픈**: 파일을 닫았다가 다시 열었을 때 먹통 없이 첫 프레임부터 로그가 온전히 노출되는지 확인.
- **탭 전환**: 여러 로그 탭을 오갈 때 깜빡임이나 잔상, 굳어버림 현상이 완전히 사라졌는지 확인.

---

## 🎯 형님! 승인(Proceed)을 내려주십시오!

아래의 `Proceed` 버튼을 눌러 승인해 주시면, 펭귄이 작업실에서 즉시 빛의 속도로 코드를 조율하여 명품 코드를 안착시키겠습니다! 🥊🐧🔥
