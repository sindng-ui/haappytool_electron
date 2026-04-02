# Gauss Chat 디버그 창 추가 계획

형님! 가우스 응답이 왜 안 보이는지 답답하시죠? 실시간으로 어떤 데이터가 오가는지 확인할 수 있는 **'Raw Response 디버그 창'**을 우측에 깔끔하게 붙여보겠습니다. 🐧🔍

## Proposed Changes

### 1. [plugins/GaussChatAgent/index.tsx](file:///mnt/k/Antigravity_Projects/gitbase/happytool_electron/plugins/GaussChatAgent/index.tsx) [MODIFY]
- **디버그 상태 추가**: `showDebug` (토글 상태)와 `debugLogs` (수신된 모든 로우 데이터) 상태를 추가합니다.
- **레이아웃 확장**: 우측에 접이식 디버그 패널을 추가합니다.
- **실시간 로그 기록**: `sendChatMessage` 시 발생하는 모든 청크를 디버그 로그에 쌓습니다.

### 2. [plugins/GaussChatAgent/GaussChatService.ts](file:///mnt/k/Antigravity_Projects/gitbase/happytool_electron/plugins/GaussChatAgent/GaussChatService.ts) [MODIFY]
- **Raw 데이터 콜백 추가**: 파싱된 텍스트뿐만 아니라, 필요 시 로우 데이터도 컴포넌트로 넘겨줄 수 있게 확장합니다.

## Design Aesthetics
- **Terminal Style**: 디버그 창은 개발자 감성이 느껴지는 터미널 스타일(검은 배경, 밝은 녹색 텍스트)로 구현합니다.
- **Collapsible**: 평소에는 숨겨두었다가 필요할 때만 아이콘을 눌러 열 수 있게 합니다.

---

## Verification Plan

### Manual Verification
- 채팅 전송 시 우측 패널에 `data: {...}` 형태의 로우 데이터가 실시간으로 찍히는지 확인합니다.
- 패널 열기/닫기 토글이 부드럽게 작동하는지 확인합니다.

---
형님, 이제 깜깜이 채팅은 그만하고 속 시원하게 데이터 까보면서 하시죠! [Proceed] 눌러주시면 바로 작업 들어갑니다! 🐧🔥🛠️
