# Implementation Plan: Tizen Quick Command Palette

자주 사용하는 Tizen(SDB/SSH/Serial) 명령어들을 저장하고, 연결 중에만 호출하여 즉시 실행할 수 있는 플로팅 패널 기능을 추가합니다.

## 1. Feature Overview
- **Activation Condition**: SDB, SSH, 또는 Serial 연결이 활성화된 상태에서만 UI 노출.
- **UI Design**: 
    - 로그 뷰어 우측 하단 혹은 입력창 옆에 작고 세련된 플로팅 버튼 배치.
    - 클릭 시 'Quick Command' 목록이 상단/측면으로 확장되는 애니메이션 적용.
- **Functionality**:
    - **One-Click Send**: 명령어 클릭 시 현재 연결된 채널(SDB/SSH/Serial)을 통해 즉시 실행.
    - **Command Management**: 명령어 이름과 실제 명령어를 추가/삭제/수정 가능.
    - **Persistence**: `localStorage`를 사용하여 사용자 커스텀 명령어 목록 유지.

## 2. Component Structure
- **`components/LogViewer/QuickCommandPanel.tsx` (NEW)**:
    - `commands`: `{ id, name, cmd }` 배열 상태 관리.
    - `isExpanded`: 패널 확장 여부.
    - `onExecute(cmd)`: `sendTizenCommand` 호출부.
- **`hooks/useLogExtractorLogic.ts`**:
    - 전역 설정(AppSettings) 혹은 전용 로컬 상태로 명령어 목록 관리 로직 추가.

## 3. Interaction Flow
1. **연결 성공**: Tizen Connection Modal을 통해 연결되면 `Quick Command` 버튼이 활성화됨.
2. **소환**: 버튼 클릭 시 자주 쓰는 명령어 리스트 노출.
3. **발사**: 원하는 명령어 클릭 -> `sendTizenCommand(cmd)` 호출 -> 장비 반영.
4. **관리**: `+` 버튼으로 새 명령어 추가, 우클릭이나 삭제 아이콘으로 정리.

---
형님, 이 방향이 맞을까요? **Proceed**를 눌러주시면 바로 "명령어 발사대" 제작 들어갑니다! 🐧🚀
