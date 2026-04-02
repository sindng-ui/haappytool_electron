# 가우스 에이전트 빌더 변수 인식 오류 수정 계획

형님! 가우스 에이전트 빌더가 시스템 인스트럭션 내의 JSON 예제(`{ "status": ... }`)를 템플릿 변수로 오해해서 발생하는 "invalid variables" 에러를 해결하겠습니다.

## User Review Required

> [!IMPORTANT]
> 가우스 빌더는 `{변수명}` 형태를 보면 무조건 입력 변수로 처리하려 합니다. 특히 `"status"` 처럼 큰따옴표가 포함된 키값을 변수명으로 인식하면서 에러가 발생한 것으로 보입니다.

## Proposed Changes

### 1. [docs/gauss_system_instructions.md](file:///mnt/k/Antigravity_Projects/gitbase/happytool_electron/docs/gauss_system_instructions.md) [MODIFY]
- **JSON 예시 형식 변경**: 중괄호 `{ }` 대신 다른 기호(예: `[ ]` 또는 `< >`)를 사용하여 빌더의 변수 인식 엔진을 우회합니다.
- **모델 가이드 추가**: "응답 시에는 반드시 표준 JSON 형식인 중괄호`{}`와 큰따옴표`"`를 사용해야 한다"는 명시적 지침을 추가하여 모델이 혼동하지 않게 합니다.
- **특수 기호 회피**: 에러 메시지에 언급된 `"status"`가 변수로 인식되지 않도록 예시 텍스트를 다듬습니다.

---

## Open Questions

- 빌더 설정 중에 **"변수(Variable)"** 탭에 별도로 정의하신 변수가 있나요? (예: `rules`, `history` 등) 만약 있다면 해당 변수들만 프롬프트에서 `{rules}` 형태로 사용할 수 있습니다.

## Verification Plan

### Manual Verification
- 수정된 텍스트를 가우스 에이전트 빌더의 'Rule' 또는 'System Instruction' 칸에 다시 붙여넣어 에러가 사라지는지 확인합니다.
- 가우스 모델과 대화하여, 예시가 바뀌었음에도 불구하고 실제 응답은 올바른 JSON(`{ "status": ... }`)으로 나오는지 테스트합니다.

---
형님, 빌더가 너무 똑똑한 척 하다가 바보가 됐네요! 제가 기호를 살짝 바꿔서 빌더 눈을 속여보겠습니다. [Proceed] 버튼 눌러주세요!
