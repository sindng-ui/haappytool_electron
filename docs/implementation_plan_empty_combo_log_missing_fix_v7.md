# 📋 빈 룰 깜빡임(Jank) 현상 완전 소탕 구현 계획서 (v7) 🐧🥊

형님! 새 파일을 열었을 때 로그가 살짝 보였다가 스르륵 로딩창으로 사라지던 불편한 깜빡임 jank 현상의 **물리적 엇박자**를 최종 포착하여 단숨에 해결할 수 있는 신의 한 수를 수립했습니다!

---

## 🚨 로그가 살짝 보였다가 사라지던 엇박자 원인

1. **`INDEX_COMPLETE`의 선제 세팅**:
   - 인덱싱 완료 시점에 `filteredCount`를 전체 라인 수로 세팅해 주므로 로그가 화면에 즉시 보입니다 (살짝 보였다가 의 시점!).
2. **무의미한 빈 룰 재요청으로 인한 `Ready=false` 강등**:
   - 150ms 뒤에 디바운싱 필터(`applyFilter`)가 트리거되는데, 이때 현재 미션이 빈 룰일지라도 워커에 `FILTER_LOGS` 메시지를 던지기 직전에 **`setLeftWorkerReady(false)`를 호출**합니다.
   - 이로 인해 화면이 다시 로딩창으로 스르륵 강등(로그가 사라지는 시점!)되었다가 워커가 빈 룰 바이패스를 끝내고 응답하면 그제서야 다시 `true`가 되어 로그가 보였던 것입니다.

---

## 🛠️ Proposed Changes (제안된 v7 초광속 깜빡임 근절 패치)

어차피 빈 룰 상태라면 워커에 무의미한 중복 필터링을 요청해 화면을 깜빡거리게 만들 이유가 전혀 없습니다!

### 1) [useLogExtractorLogic.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/hooks/useLogExtractorLogic.tsx) [MODIFY]
- 필터 적용(`applyFilter`) 단계에서, 현재 설정이 아무런 필터 조건이 없는 완전히 빈 룰(`effectiveIncludes.length === 0 && effectiveExcludes.length === 0 && quickFilter === 'none'`) 상태라면, 캐시 해시만 최신화해 둔 뒤 **워커에 메시지를 쏘지도 않고 `Ready(false)` 강등도 시키지 않고 즉시 평화롭게 리턴**하도록 차단막을 탑재합니다!

```typescript
                lastFilterHashLeft.current = payloadHash;

                // 🐧 형님! 어차피 아무 필터 조건도 없는 완전히 빈 룰 상태라면,
                // INDEX_COMPLETE 시점에 이미 전체 로그가 완벽 세팅되었으므로,
                // 무의미하게 워커에 필터를 요청해 화면을 깜빡(Ready=false)거리게 만들지 않고 즉시 평화롭게 멈춥니다!
                if (effectiveIncludes.length === 0 && effectiveExcludes.length === 0 && quickFilter === 'none') {
                    console.log('[useLog-Left] Empty filter detected. Bypassing redundant FILTER_LOGS to prevent screen flickers!');
                    return;
                }

                // 🐧🎯 형님! 작업 직전에 캐시를 비워야 설정창 색깔 변화와 화면 갱신이 한 호흡에 일어납니다!
                setLeftWorkerReady(false);
```
*(우측 패널에도 완전히 동일한 차단막을 탑재합니다)*

---

## ⚙️ Verification Plan (검증 계획)

1. **자동 타입 및 빌드 검사**:
   - `npx tsc --noEmit`을 WSL bash에서 실행하여 무결성 검증
2. **시나리오 수동 입증**:
   - 파일 로딩 후 콤보가 없을 때 단 한 차례의 깜빡임이나 사라짐 없이 **처음부터 영원히 무결하게 원본 로그가 안정적으로 즉시 보이는지** 수동 입증

---

## 🚀 형님! 동의하신다면 바로 "고고" 또는 "고"를 외쳐주십쇼! 10초 만에 깜빡임을 완전히 근절해 버리겠습니다! 🐧🥊🔥

> [ Proceed / 고고! ]
