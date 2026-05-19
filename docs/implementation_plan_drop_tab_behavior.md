# 🛠️ Notepad++ 스타일 파일 드롭(Drop) 및 새 탭 처리 구현 계획서 (V2 - 백그라운드 중복 탭 활성화 지원)

형님! active 탭이 아니더라도 **이미 다른 탭에 열려있는 파일과 동일한 이름(경로)의 파일을 드롭하거나 열기** 하면, **해당 탭이 즉시 active 탭이 되면서 새로 읽는(Reload) 초고급 Notepad++ UX**를 완성하기 위한 정밀 설계 계획서 V2입니다! 🐧💎🔥

---

## 🔍 초고급 요구사항 분석 (V2 핵심)
1. **백그라운드 중복 탭 추적 활성화**:
   - 현재 탭(A)이 켜져 있는 상태에서, 백그라운드 탭(B)에 이미 열려있는 `test.log` 파일을 탭 A 화면에 드롭하거나 열면:
     - 탭 A에서 열리는 것이 아님!
     - 탭 B가 **Active 탭으로 즉시 활성화**되면서 **데이터 새로고침(Reload)**이 기동되어야 함!
2. **동일 파일의 리로딩 보장**:
   - 이미 해당 탭에서 작동 중이던 동일 파일에 대해 중복 로딩 필터링을 풀고, 파일의 갱신본을 안전하게 처음부터 끝까지 백그라운드 워커에 전달해 다시 읽습니다.

---

## 💡 V2 해결 설계안 (전역 파일 오픈 허브 도입)

개별 탭의 훅 수준에서는 전체 탭 목록(`tabs`)의 상태를 알고 탭을 스위칭할 수 없으므로, 최상단 `LogExtractor.tsx`에 **전역 파일 오픈 허브(`handleOpenFile`)**를 구축하고 이를 하위 훅으로 위임하여 전 탭의 파일 드롭 및 열기 이벤트를 중앙 제어합니다.

### 1. 전역 파일 오픈 허브 (`handleOpenFile`) 흐름도
```mermaid
graph TD
    A[사용자가 임의의 탭에 드롭 또는 수동 파일 열기] --> B[handleLeftFileChange 가동]
    B --> C{onOpenFile 허브 핸들러가 존재하는가?}
    C -- Yes --> D[onOpenFile(file) 로 전적 처리 위임]
    D --> E{전체 탭 중 동일한 파일 경로/파일명이 이미 존재하나?}
    
    E -- Yes (백그라운드 탭에 존재) --> F[setActiveTabId 로 해당 탭 즉시 화면 활성화 + initialFile 갱신으로 강제 리로드 트리거]
    E -- No (새로운 파일) --> G{현재 Active 탭이 빈 탭인가?}
    
    G -- Yes (빈 탭) --> H[현재 탭에 그대로 덮어씌워 로드]
    G -- No (열려있는 탭) --> I[onAddFileTab 호출하여 새 탭 생성 및 활성화]
```

---

## 🛠️ 수정 대상 파일 및 변경 사항 (Target Files)

1. **[components/LogViewer/LogContext.tsx](file:///mnt/k/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/LogContext.tsx)**:
   * Props에 `onOpenFile` 전달 통로 개설.
2. **[hooks/useLogExtractorLogic.tsx](file:///mnt/k/Antigravity_Projects/gitbase/happytool_electron/hooks/useLogExtractorLogic.tsx)**:
   * `LogExtractorLogicProps`에 `onOpenFile` 콜백 규격 추가 및 `useLogFileOperations` 호출 시 인자로 주입.
3. **[hooks/useLogFileOperations.ts](file:///mnt/k/Antigravity_Projects/gitbase/happytool_electron/hooks/useLogFileOperations.ts)**:
   * `UseLogFileOperationsProps`에 `onOpenFile` 추가.
   * `handleLeftFileChange` 진입 시 `onOpenFile`이 주입되어 있다면 이를 먼저 위임 호출하여 조기 리턴 처리!
   * `initialFile` 변경 감지 이펙트를 보강하여, 백그라운드 탭이 Active로 갱신되며 `initialFile`이 교체되었을 때 즉시 워커 데이터를 강제 리로드하도록 구성.
4. **[components/LogExtractor.tsx](file:///mnt/k/Antigravity_Projects/gitbase/happytool_electron/components/LogExtractor.tsx)**:
   * 최상단에 중복 탭 스위칭 및 빈 탭 분기 처리를 전담하는 **`handleOpenFile` 전역 허브 함수** 설계 및 주입.
   * `<LogProvider>` 에 `onOpenFile={handleOpenFile}` 전달.

---

## 🧪 V2 검증 시나리오
1. **백그라운드 중복 탭 활성화 & 리로드**:
   * 탭 1(`A.log`), 탭 2(`B.log`)가 열려 있는 상태에서 탭 2를 보고 있을 때, 탭 2 화면에 `A.log`를 드롭합니다.
   * 화면이 **탭 1(`A.log`)로 휙 전환(Active)**되며 해당 파일이 새로 읽히는지 검증합니다.
2. **빈 탭 드롭**:
   * 새 빈 탭을 띄우고 파일 드롭 시 탭이 무한히 늘어나지 않고 현재 탭에 안전하게 열리는지 확인합니다.
3. **중복 없는 다른 파일 드롭**:
   * 완전히 새로운 `C.log`를 탭에 던졌을 때 정상적으로 새 탭이 생성되면서 Active 탭으로 자동 포커싱되는지 확인합니다.

---

## 🚀 V2 Proceed 승인 요청

형님! 요구 사항을 철저히 반영하여 더욱 빈틈없고 단단해진 백그라운드 전역 스위칭 설계안 V2입니다. 검토하시고 **"Proceed"** 혹은 **"고고"**라고 승인해 주시면 번개처럼 코딩에 착수하겠습니다! 🐧🔥🥊
