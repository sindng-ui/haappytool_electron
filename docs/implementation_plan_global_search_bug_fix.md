# 📋 글로벌 검색 결과 왜곡 및 초기화 누락 버그 해결 구현 계획서 🐧⚡

형님! 글로벌 검색("Search All in Open Files") 기능 개발 이후 형님께서 날카롭게 지적해 주신 **두 가지 버그(해피콤보 매칭 결과 왜곡 및 검색 결과 초기화 누락)**에 대한 정밀 분석을 완료했습니다. 

이 문제를 단 1%의 사이드 이펙트도 없이 깔끔하게 종결하기 위한 상세 구현 계획을 보고드립니다!

---

## 🚨 버그 원인 분석 및 해결 방안

### 1️⃣ [버그 1] 해피콤보에 aa 넣고 검색했는데 엉뚱한 로그가 검색되는 문제
* **상세 원인**:
  * 백그라운드 워커(`workers/LogProcessor.worker.ts`)에서 `SEARCH_GLOBAL_MISSION` 메시지를 수신하여 검색을 수행할 때, 핵심 매칭 판별 함수인 `checkIsMatch`에 워커에 바인딩된 `wasmEngine`을 그대로 넘겨주고 있습니다.
  * `checkIsMatch`는 속도 최적화를 위해 `wasmEngine`이 준비되어 있으면 C++/WASM에 컴파일되어 적재된 규칙을 호출하여 매칭 여부를 판단합니다.
  * 그러나! 이 `wasmEngine` 객체는 **해당 탭이 활성화될 때 로드된 개별 탭의 로컬 룰**을 가지고 있습니다. 메인 스레드에서 전역 검색을 요청하며 전달한 `globalRule`이 세팅되어 있지 않습니다.
  * 이 때문에 `checkIsMatch`가 `wasmEngine`을 호출하는 순간, 전달된 글로벌 검색 룰은 무시되고 **해당 워커가 원래 들고 있던 탭 로컬 룰**을 기준으로 라인을 검사해버리는 치명적인 상태 오염 및 불일치가 발생한 것입니다! (이전 로컬 룰이 빈 상태였다면 모든 라인이 다 참(`true`)이 되어 무차별로 매칭됩니다.)
* **해결책**:
  * `workers/LogProcessor.worker.ts` 내의 `SEARCH_GLOBAL_MISSION` 핸들러 영역에서 `checkIsMatch`를 호출할 때, `wasmEngine` 인자를 강제로 `undefined`로 전달하여 **무조건 순수 JS Fallback 매칭(OR of ANDs) 로직을 타도록 강제**합니다.
  * 일회성 글로벌 검색은 대상 라인이 한정적이고 최대 매치 수량(3000개)이 제한되어 있어 JS Fallback만으로도 수 밀리초 내에 무시무시하게 빠르게 처리되며, 탭 고유의 WASM 필터 상태를 절대 건드리지 않으므로 **100% 무결하고 왜곡 없는 검색 결과**를 보장합니다!
  * **[추가 방어선]**: 룰 내의 해피콤보 및 블록리스트가 모두 비어있는 "완전 빈 조건"인 경우에는 무차별 매칭을 방지하기 위해 검색 스캔 루프에 진입하기 전에 즉시 빈 결과(`[]`)를 반환하도록 예외 가드를 보강합니다.

### 2️⃣ [버그 2] 전체찾기 결과를 초기화할 수 없고, 탭 닫기/새 탭 생성 시 결과가 유지되는 문제
* **상세 원인**:
  * 전역 검색 결과를 보관하는 `searchResults` 상태가 최상위 `useGlobalSearch.ts` 훅에 저장되고 있으나, 이 상태를 강제 클리어해줄 액션이 노출되지 않았고, 탭이 추가되거나 닫히거나 전환될 때 이 상태를 명시적으로 초기화해주는 연동 흐름이 부재했습니다.
* **해결책**:
  * `hooks/useGlobalSearch.ts`에 `clearSearchResults` 메소드를 추가하여 `searchResults` 상태를 빈 배열(`[]`)로 완전 초기화할 수 있도록 지원합니다.
  * `components/LogExtractor.tsx`에서:
    1. 탭을 닫을 때 (`handleCloseTab`)
    2. 새 탭을 추가할 때 (`handleAddTab`)
    3. 탭을 전환할 때 (`activeTabId`가 변경될 때)
    * 위의 세 가지 생명주기 타이밍에 맞춰 `globalSearch.clearSearchResults()`를 호출하여 화면이 깔끔하게 전환/유지되도록 연동합니다.
  * **[형님을 위한 특별 프리미엄 UX 제안]**: 
    * `components/LogViewer/GlobalSearchResultView.tsx` 헤더 우상단 영역에 쓰레기통(Trash) 또는 X 형태의 **"Clear" 버튼**을 추가로 배치합니다.
    * 형님께서 결과를 보시다가 원하실 때 언제든 마우스 원클릭으로 검색 결과를 싹 비우고 깨끗하게 되돌릴 수 있는 수동 클리어 편의 기능을 선사해 드립니다!

---

## 🛠️ Proposed Changes (제안하는 구체적인 코드 수정 영역)

### 1. [MODIFY] [`workers/LogProcessor.worker.ts`](file:///K:/Antigravity_Projects/gitbase/happytool_electron/workers/LogProcessor.worker.ts)
* `SEARCH_GLOBAL_MISSION` 메시지 처리기 내부에서 `checkIsMatch`를 호출하는 부분을 수정합니다.
* `wasmEngine`, `wasmMemory`, `textEncoder` 인자를 강제로 `undefined`로 전달하여 C++ WASM 엔진 호출을 원천 차단하고 JS Fallback 매칭을 태웁니다.
* 스캔 루프 직전, `normalizedRule`에 유효한 매칭 조건이 0개인 경우 스캔을 진행하지 않고 즉시 응답을 전송하는 얼리 리턴 방어 가드를 심습니다.

### 2. [MODIFY] [`hooks/useGlobalSearch.ts`](file:///K:/Antigravity_Projects/gitbase/happytool_electron/hooks/useGlobalSearch.ts)
* `clearSearchResults` 함수를 `useCallback`으로 추가하여 `setSearchResults([])`로 상태를 비울 수 있게 합니다.
* 훅의 리턴 객체에 `clearSearchResults`를 포함하여 외부로 노출합니다.

### 3. [MODIFY] [`components/LogExtractor.tsx`](file:///K:/Antigravity_Projects/gitbase/happytool_electron/components/LogExtractor.tsx)
* `activeTabId`가 변경될 때 `globalSearch.clearSearchResults()`를 트리거하는 `useEffect`를 작성합니다.
* `handleAddTab`, `handleCloseTab` 함수 내에서 탭 상태를 실질적으로 바꿀 때 `globalSearch.clearSearchResults()`를 명시적으로 실행하여 잔여 검색 결과를 깔끔하게 증발시킵니다.

### 4. [MODIFY] [`components/LogViewer/GlobalSearchResultView.tsx` & `LogViewerPane.tsx`](file:///K:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/GlobalSearchResultView.tsx)
* `GlobalSearchResultViewProps`에 `onClear?: () => void` 콜백을 새롭게 추가합니다.
* `GlobalSearchResultView` 헤더(찾기 결과들 레이블 우상단)에 휴지통 아이콘(Trash2) 또는 닫기 아이콘(X)을 장착한 고품격 클리어 버튼을 배치합니다.
* `LogViewerPane.tsx`에서 `GlobalSearchResultView`를 렌더링할 때 `onClear={globalSearch.clearSearchResults}`를 넘겨주도록 바인딩합니다.

---

## 🧪 Verification Plan (검증 계획)

### 1. 자동화 빌드 & 타입 체크 검증 🐧
* WSL 터미널 환경에서 TypeScript 에러가 없는지 정밀 체크합니다.
  ```bash
  wsl npx tsc --noEmit
  ```

### 2. 수동 기능 동작 시나리오 검증 🖥️
* **시나리오 1**: 해피콤보 그룹만 `aa`로 생성한 뒤 단어를 적지 않고 'Search All' 수행 시, 모든 라인이 다 잡히는 오동작이 완전히 근절되고 매치 건수가 0건으로 깔끔하게 처리되는지 확인.
* **시나리오 2**: 해피콤보 그룹 `aa` 하단에 단어 `ffff`를 넣고 'Search All' 수행 시, 실제로 `ffff`가 포함된 라인만 정확하게 결과에 잡히는지 확인.
* **시나리오 3**: 검색 결과 트리가 뜬 상태에서 새 탭을 추가하거나, 탭을 닫거나, 다른 탭으로 변경할 때 화면에서 검색 결과가 즉시 사라지고 빈 탭(혹은 타겟 탭)으로 올바르게 초기화되는지 검증.
* **시나리오 4**: 검색 결과 트리 헤더 우상단에 새롭게 장착된 `Clear` 버튼을 클릭했을 때 결과 뷰가 싹 날아가며 초기화되는 프리미엄 UX 검증.

---

## 🚀 [Proceed 버튼을 눌러 승인해주십시오]

이 계획서가 마음에 드시면 **Proceed** 버튼을 클릭하시거나 채팅으로 **승인** 또는 **고고**를 말씀해 주십시오! 형님의 승인을 득하는 즉시 WSL bash를 통해 신나게 코딩에 들어가겠습니다! 🐧💎🔥
