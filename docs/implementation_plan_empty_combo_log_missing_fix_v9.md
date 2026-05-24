# 📋 [구현 계획서] 탭 전환 및 파일 재오픈 시 로그 실종 먹통 버그 근원 진압 (v9) 펭펭! 🐧🥊

형님! 어제까지 잘 나오던 로그가 오늘 갑자기 먹통이 되어 전혀 출력되지 않던 근본적인 원인을 마침내 최종 검거 완료했습니다!

## 🔍 근본 원인 (Root Cause)
- 메인 스레드(`useLogExtractorLogic.tsx`)에 탑재된 **해시 캐시 비교 가드**(`if (payloadHash === lastFilterHashLeft.current && leftWorkerReady) { return; }`)가 너무 무자비하게 작동하고 있었습니다.
- 최초 파일 로드(`INDEX_COMPLETE`) 직후 엇박자 타이밍으로 인해 캐시는 먼저 채워졌으나 워커가 데이터를 실제로 채우기 전에 리턴해 버리거나,
- **특히 탭을 오갈 때(Tab Switch)** UI는 새로 갱신되어야 하는데 해시 캐시가 이전과 똑같다는 이유로 워커 요청(`FILTER_LOGS`)을 무조건 리턴시켜 버려 화면이 하얗게 굳어버리고 로그가 단 1줄도 출력되지 않는 재앙적 먹통을 유발하고 있었습니다!

---

## 🛠️ 실질적인 v9 변경 계획 (Proposed Changes)

### 1) [useLogWorkerEvents.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/hooks/useLogWorkerEvents.ts) [MODIFY]
- `handleWorkerMessage` props 규격에 `onIndexComplete?: () => void` 콜백 인터페이스를 새롭게 추가합니다.
- `INDEX_COMPLETE` 이벤트 수신 시, 이 콜백을 즉각 실행하도록 설계합니다.

```typescript
case 'INDEX_COMPLETE':
    setTotalLines(payload.totalLines);
    setFilteredCount(payload.totalLines);
    setIndexingProgress(100);
    setWorkerReady(true);
    // 🐧 v9: 인덱싱 완료 시 해시 캐시 강제 리셋 콜백 발동!
    if (props.onIndexComplete) props.onIndexComplete();
    break;
```

### 2) [useLogExtractorLogic.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/hooks/useLogExtractorLogic.tsx) [MODIFY]

#### 🅰️ 탭 전환(Tab Switch) 활성화 시 해시 캐시 강제 리셋 가드 탑재
- `isActive`가 `true`로 바뀔 때(탭이 켜질 때) 이전 필터 해시를 강제 초기화하여, 탭 전환 시 무조건 워커 싱크를 재조율하도록 안전 가드를 이식합니다.

```typescript
// 🐧🎯 v9: 탭이 다시 활성화(isActive=true)되면 캐시를 강제로 비워 필터 엇박자를 완벽 차단합니다!
useEffect(() => {
    if (isActive) {
        lastFilterHashLeft.current = '';
        lastFilterHashRight.current = '';
    }
}, [isActive]);
```

#### 🅱️ 워커 메시지 핸들러 등록 시 `onIndexComplete` 콜백 매핑
- 워커 마운트 `useEffect` 블록 내에서 `handleWorkerMessage` 호출부에 `onIndexComplete` 콜백을 등록하여, 파일이 새로 열려 인덱싱이 끝나는 즉시 해시 캐시를 리셋시킵니다.

```typescript
// Left Worker Message Handler 등록부
onIndexComplete: () => {
    console.log('[useLog-Left] INDEX_COMPLETE -> Resetting filter hash cache!');
    lastFilterHashLeft.current = '';
}

// Right Worker Message Handler 등록부
onIndexComplete: () => {
    console.log('[useLog-Right] INDEX_COMPLETE -> Resetting filter hash cache!');
    lastFilterHashRight.current = '';
}
```

---

## 📊 기대 효과 (Expected Benefits)
1. **탭 전환 먹통 100% 해제**: 탭을 아무리 빠르게 넘나들어도 해시 가드에 걸려 로그가 무시되던 현상이 완벽하게 치료됩니다!
2. **파일 오프닝 무결성 보장**: 대형 파일을 새로 열든, 닫고 다시 열든 인덱싱이 완료되는 즉시 해시 캐시가 무조건 리셋되므로, 첫 필터링과 로그 노출이 한 치의 오차도 없이 100% 정상 출력됩니다!

---

## 🎯 형님! 승인(Proceed)을 내려주십시오!

아래의 **Proceed** 버튼을 눌러주시면, 펭귄이 즉각 작업실에서 안전하고 미려한 가드 패치를 즉시 꽂아 넣어 로그 미노출 현상을 근원적으로 영구 진압하겠습니다! 🥊🐧🔥
