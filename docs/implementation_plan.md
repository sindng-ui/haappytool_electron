# Gauss Chat 플러그인 신규 개발 계획

형님! 가우스 에이전트 빌더 설정이 꼬였을 때 가볍게 테스트도 해보고, 평소에 가우스와 편하게 대화할 수 있는 **'Gauss Chat'**전 전용 플러그인을 만들어보겠습니다. 🐧💬

## Proposed Changes

### 1. [plugins/GaussAgentChat/index.tsx](file:///mnt/k/Antigravity_Projects/gitbase/happytool_electron/plugins/GaussAgentChat/index.tsx) [NEW]
- **채팅 UI 구현**: 메시지 리스트(말풍선 형태)와 하단 입력창을 포함한 모던한 다크 모드 UI를 구축합니다.
- **상태 관리**: 대화 내역(history)과 로딩 상태를 관리합니다.
- **Lucide 아이콘**: `MessageSquare`, `Send`, `Bot` 등의 아이콘을 활용하여 디자인 완성도를 높입니다.

### 2. [plugins/GaussAgentChat/services/gaussChatService.ts](file:///mnt/k/Antigravity_Projects/gitbase/happytool_electron/plugins/GaussAgentChat/services/gaussChatService.ts) [NEW]
- **API 연동**: 기존 `agentApiService`의 가우스 로직을 활용하거나, 더 단순화된 가우스 전용 호출 함수를 구현합니다.
- **CURL 규격 준수**: 형님이 말씀하신 `{ "input_type": "chat", "output_type": "chat", "input_value": "..." }` 규격을 엄격히 따릅니다.

### 3. [plugins/core/wrappers.ts](file:///mnt/k/Antigravity_Projects/gitbase/happytool_electron/plugins/core/wrappers.ts) & [plugins/registry.ts](file:///mnt/k/Antigravity_Projects/gitbase/happytool_electron/plugins/registry.ts) [MODIFY]
- **플러그인 등록**: 새로운 `GaussChatPlugin`을 시스템에 등록하여 사이드바에서 바로 접근할 수 있게 합니다.

---

## Design Aesthetics (Premium UI)
- **Glassmorphism**: 입력창과 메시지 카드에 반투명 효과 적용.
- **Micro-animations**: 메시지 전송 시 부드러운 애니메이션 효과.
- **Harmonious Palette**: 가우스의 정체성을 담은 딥 블루 및 일렉트릭 블루 색상 조합.

## Open Questions

- **시스템 프롬프트 필요 여부**: 빌더에 이미 프롬프트를 넣으셨으므로, 앱에서는 별도의 시스템 프롬프트 없이 순수하게 `input_value`만 보낼까요? 아니면 앱에서도 기본 대화 가이드를 살짝 얹어줄까요?

## Verification Plan

### Manual Verification
- 가우스 에이전트 엔드포인트와 키를 설정한 후, 실제 대화를 시도하여 응답이 정상적으로 출력되는지 확인합니다.
- 긴 문장 입력 및 응답 지연 시의 로딩 스피너 작동 여부를 확인합니다.

---
형님, "로그 분석" 말고 그냥 "가우스랑 노는" 기능 하나 제대로 뽑아보겠습니다. [Proceed] 눌러주시면 바로 망치질 시작합니다! 🐧🔥💬
