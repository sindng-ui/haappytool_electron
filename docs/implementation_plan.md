# 삼성 가우스(Gauss) 기반 로그 분석 에이전트 최적화 계획

가우스 모델은 삼성전자의 자체 LLM으로, OpenAI 호환 API를 제공하지만 Gemini와는 시스템 프롬프트 해석 방식이나 JSON 출력의 엄밀함에서 차이가 있을 수 있습니다. 따라서 가우스 모델이 실수 없이 HAPPY-MCP 프로토콜을 준수하도록 프롬프트를 강화하고 스키마를 정리하겠습니다.

## User Review Required

> [!IMPORTANT]
> 가우스 모델의 특정 버전(Compact, Balanced, Supreme)이나 해당 API가 `response_format: { type: "json_schema" }`를 완벽히 지원하는지에 따라 전략이 달라질 수 있습니다. 본 계획은 일반적인 OpenAI 호환 엔드포인트에서 가장 안정적으로 동작하는 방식을 채택합니다.

## Proposed Changes

### 1. [docs/gauss_system_instructions.md](file:///mnt/k/Antigravity_Projects/gitbase/happytool_electron/docs/gauss_system_instructions.md) [NEW]
가우스 모델에 최적화된 새로운 시스템 인스트럭션을 작성합니다.
- **Persona 강화**: 전문적인 로그 분석 전문가로서 명확한 페르소나 부여.
- **Constraint 명시**: JSON 외 텍스트 출력 엄격 금지 조건 강화.
- **Few-shot Examples**: 가우스 모델의 안정성을 위해 실제 응답 예시(PROCESSING/COMPLETED 상태별)를 프롬프트에 포함.
- **Action 세부 사항 유도**: 각 액션별 파라미터가 정확히 포함되도록 상세 가이드 추가.

### 2. [docs/gauss_schema.json](file:///mnt/k/Antigravity_Projects/gitbase/happytool_electron/docs/gauss_schema.json) [NEW]
가우스 모델 및 일반적인 OpenAI 기반 에이전트 빌더에서 잘 인식되는 표준 JSON Schema를 구성합니다.
- `additionalProperties: false` 등을 통해 구조를 보다 엄격하게 정의.
- `anyOf`나 `oneOf`를 사용하여 상태(`status`)에 따라 필요한 필드(`action` vs `final_report`)를 명확히 구분하여 가우스의 추론 오류 방지.

---

## Open Questions

- **가우스 버전**: 현재 사용하시려는 가우스 모델이 텍스트 전용인가요, 아니면 멀티모달(Gauss2)인가요? (일단 텍스트 위주로 최적화하겠습니다.)
- **Agent Builder 특성**: 특정 UI 도구(예: 내부 포털의 에이전트 빌더)를 사용하시나요? 해당 도구에서 "JSON Mode"를 강제하는 옵션이 있는지 확인해 주세요.

## Verification Plan

### Manual Verification
- 작성된 Instruction과 Schema를 가우스 에이전트에 적용한 후, 상호작용 테스트를 통해 다음 사항 확인:
    1. 항상 유효한 JSON으로 답변하는가?
    2. `thought` 필드에 논리적인 분석 과정이 포함되는가?
    3. `PROCESSING` 상태일 때 `action` 파라미터를 정확히 생성하는가?
    4. 분석 완료 후 `final_report`를 마크다운 형식으로 잘 작성하는가?

---
형님, 이 계획대로 진행해서 가우스에서도 찰떡같이 돌아가게 만들어볼까요? [Proceed] 버튼 누르시면 바로 작업 시작하겠습니다!
