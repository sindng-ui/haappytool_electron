# [Log Extractor] 전체 선택(Ctrl+A) 전용 로직 구현 계획

형님, 로그 보다가 로그만 싹 다 선택하고 싶은데 화면 전체가 다 선택돼서 짜증나셨죠? 🐧💢 `Ctrl+A`를 눌렀을 때 현재 보고 있는 로그들만 예쁘게 전체 선택되도록 로직을 짜보겠습니다.

## User Review Required

> [!IMPORTANT]
> `Ctrl+A`를 누르면 브라우저의 기본 전체 선택(화면 상의 모든 텍스트)을 막고(`preventDefault`), 현재 필터링된 로그 전체 인덱스를 선택 상태로 만듭니다.

## Proposed Changes

### [Logic] [useLogExtractorLogic.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/hooks/useLogExtractorLogic.ts)

- `handleSelectAllLogs(paneId: 'left' | 'right')` 함수를 추가합니다.
- 해당 판넬의 `filteredCount` 만큼 반복문을 돌려 `Set`에 모든 인덱스를 집어넣고 `setSelectedIndices`를 업데이트합니다.
- (성능 고려) 대용량(`filteredCount > 1,000,000`)의 경우 `Set` 생성 시 부하가 있을 수 있으므로, 메모리 효율적인 방식으로 처리합니다.

### [Component] [LogViewerPane.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/LogViewerPane.tsx)

- `onSelectAll?: () => void;` 프롭을 추가합니다.
- `useLogViewerKeyboard` 호출 시 이 프롭을 넘겨줍니다.

### [Hook] [useLogViewerKeyboard.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/hooks/useLogViewerKeyboard.ts)

- `handleKeyDown` 이벤트에서 `(e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')` 조건을 체크합니다.
- 감지 시 `e.preventDefault()`와 `e.stopPropagation()`을 실행하고 `onSelectAll()`을 호출합니다.

### [Container] [LogSession.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogSession.tsx)

- `useLogExtractorLogic`에서 노출된 `handleSelectAllLogs`를 각 `LogViewerPane`에 연결합니다.

## Verification Plan

### Manual Verification
1. 로그 판넬 중 하나를 클릭하여 포커스를 줍니다.
2. `Ctrl+A`를 누릅니다.
3. 화면의 다른 텍스트(사이드바, 헤더 등)는 선택되지 않고, 로그 판넬의 로그들만 하이라이트되는지 확인합니다.
4. 이 상태에서 `Ctrl+C`를 눌러 선택된 로그들만 잘 복사되는지 확인합니다. (이전 작업 확인용)

<button id="proceed">진행 시켜!</button>
