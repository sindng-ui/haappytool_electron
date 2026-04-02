# 삼성 가우스 에이전트 API 연동 계획

형님! 제공해주신 `curl` 명령어를 분석해 보니, 가우스 에이전트 API는 표준 OpenAI 방식과는 다른 독자적인 필드(`input_value`, `x-api-key` 등)를 사용하고 있습니다. HappyTool 설정에서 엔드포인트를 입력했을 때 가우스 엔진이 찰떡같이 돌아가도록 코드를 수정하겠습니다.

## User Review Required

> [!IMPORTANT]
> 가우스 에이전트 API는 빌더에서 이미 "Rule & Role"을 설정하셨으므로, 앱에서는 분석 대상 로그와 현재 상황(User Message)만 전달하면 됩니다. 

## Proposed Changes

### 1. [plugins/LogAnalysisAgent/services/agentApiService.ts](file:///mnt/k/Antigravity_Projects/gitbase/happytool_electron/plugins/LogAnalysisAgent/services/agentApiService.ts) [MODIFY]
- **가우스 엔드포인트 감지 로직 추가**: `endpoint` URL에 `agent.sec.samsung.net`이 포함되어 있는지 확인합니다.
- **가우스 전용 요청 규격 구현**:
    - 헤더: `x-api-key` 사용.
    - 바디: `{ "input_type": "chat", "output_type": "chat", "input_value": [User Message] }` 형식으로 구성.
- **응답 파싱 로직 추가**: 가우스 에이전트가 돌려주는 응답(예: `output_value` 등)에서 JSON을 추출하는 로직을 추가합니다. (가우스 에이전트의 정확한 응답 필드명을 확인해야 하지만, 통상적인 에이전트 규격을 우선 적용하겠습니다.)

---

## Open Questions

- **엔드포인트 입력값**: 형님, 설정창의 **Endpoint** 칸에는 CURL에 보였던 URL 전체를 넣으시면 됩니다:
  `https://agent.sec.samsung.net/api/v1/run/1bd8be4f-d679-dbd2-a9be-9ef9b887801b?stream=false`
- **응답 필드 확인**: 가우스 에이전트가 결과를 돌려줄 때 어떤 필드에 담아 주나요? (예: `output_value`, `text`, `answer` 등) 혹시 아신다면 알려주시고, 모르시면 제가 가장 일반적인 `output_value`로 우선 작업해 보겠습니다.

## Verification Plan

### Automated Tests
- 가우스 엔드포인트 판별 및 바디 구성 로직에 대한 유닛 테스트(MOCK)를 수행합니다.

### Manual Verification
- 형님이 실제 엔드포인트와 API Key를 넣고 '분석 시작'을 눌러 가우스 에이전트와 통신이 성공하는지 확인합니다.

---
형님, 이 계획대로 진행해서 가우스와 해피툴을 형제처럼 연결해 볼까요? [Proceed] 버튼 눌러주시면 바로 코드 짜러 갑니다!
