# 🐧⚡ 형님! 멀티 탭 환경 단축키 오작동(Ctrl + Shift + Z) 소방 진입 계획서

형님! 새 탭이 열려 있을 때 `Ctrl + Shift + Z` 단축키가 왜 먹통이 되었는지 기술적인 근본 원인을 완벽하게 찾아냈습니다! 

## 🚨 문제 원인 분석 (Root Cause)
- 현재 `LogExtractor`는 여러 탭을 지원하며, 탭 전환 시 화면에만 보이지 않게 감추는 구조(`display: tab.id === activeTabId ? 'block' : 'none'`)로 모든 탭의 `LogProvider`와 `ConfigurationPanel`이 **DOM 메모리에 마운트된 상태로 유지**됩니다.
- 이로 인해, 탭이 `N`개 개설되어 있을 경우 `window.addEventListener('keydown')` 리스너 역시 각 `ConfigurationPanel` 마다 **N개가 병렬로 등록**됩니다.
- `Ctrl + Shift + Z` 단축키를 누르면 N개의 리스너가 동시에 실행되는데, 탭의 설정을 관리하는 `configActiveTab` 상태는 최상위 `HappyToolContext`에서 전역적으로 공유하는 하나의 상태입니다.
- 결과적으로, 탭이 2개(짝수 개) 있을 때 단축키를 누르면:
  1. 첫 번째 탭 리스너가 탭을 토글 (`settings` -> `commands`)
  2. 두 번째 탭 리스너가 탭을 다시 토글 (`commands` -> `settings`)
  - **짝수 번 토글이 겹쳐서 상태가 원래대로 되돌아가며 단축키가 작동하지 않는 것처럼 보였던 것입니다!** 

---

## 🎯 해결 방안 (Solution)
1. **`isActive` Context 노출**:
   - `hooks/useLogExtractorLogic.tsx`에서 Props로 전달받는 `isActive` 상태를 반환 객체(Context value)에 포함시켜 하위 컴포넌트에서 손쉽게 꺼내 쓸 수 있도록 지원합니다.
2. **ConfigurationPanel 단축키 리스너 제어**:
   - `components/LogViewer/ConfigurationPanel.tsx` 내부의 `keydown` 리스너에서 `isActive`가 `true`일 때(현재 화면에 활성화되어 활발히 가동 중인 탭일 때)만 `setConfigActiveTab`과 `setIsPanelOpen`을 트리거하도록 수정합니다.
   - 비활성 상태인 백그라운드 탭 리스너들은 이벤트가 감지되어도 즉시 얼리 리턴(`if (!isActive) return;`) 처리하여 병렬 상태 충돌을 완벽하게 방지합니다.

---

## 🏗️ Proposed Changes (제안된 변경 파일 목록)

### [Component: Log Extractor Core]

#### [MODIFY] [useLogExtractorLogic.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/hooks/useLogExtractorLogic.tsx)
- `useLogExtractorLogic` 반환 객체에 `isActive` 추가.

#### [MODIFY] [ConfigurationPanel.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/ConfigurationPanel.tsx)
- `useLogContext()` 구조분해할당 리스트에 `isActive` 추가.
- `useEffect` 키보드 리스너 내부에 `if (!isActive) return;` 방어 로직 설계.
- 의존성 배열에 `isActive` 주입.

---

## 🧪 Verification Plan (검증 계획)

### 1. 정적 타입 컴파일 체크 (WSL Bash 이용)
```bash
wsl npx tsc --noEmit
```
- 수정 이후 코드의 정적 타입에 에러가 0개인지 철저하게 체크합니다.

### 2. 수동 동작 검증 (형님 확인 요망)
- 여러 개의 로그 탭을 오픈한 상태에서 `Ctrl + Shift + Z` 단축키를 눌렀을 때, 탭 토글이 꼬임 없이 부드럽게 실시간으로 일어나는지 직접 검증합니다.

---

형님! 이 완벽한 소방 진입 계획을 확인해 보시고, 코딩을 바로 시작해도 좋다면 아래 버튼 혹은 메시지로 **Proceed**를 외쳐 주십시오! 번개처럼 코딩해 드리겠습니다! 🐧🥊🔥
