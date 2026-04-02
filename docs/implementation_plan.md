# 로그 분석 에이전트 사용자 힌트 필드 추가 계획

형님! 에이전트에게 분석의 결정적인 실마리(PID, TID, 주관식 힌트)를 제공할 수 있는 기능을 추가하겠습니다. 🐧🛡️🛠️🚀

## User Review Required

> [!IMPORTANT]
> **힌트 반영 방식**: 사용자가 입력한 PID, TID, 주관식 힌트는 에이전트에게 전달되는 `initial_hints` 최상단에 명확하게 구분되어 포함됩니다. 이를 통해 에이전트가 분석 시작 전부터 목표 프로세스나 스레드를 인지하고 집중할 수 있게 됩니다.

## Proposed Changes

### 1. UI 개선 (Agent Config Panel)

#### [MODIFY] [AgentConfigPanel.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/LogAnalysisAgent/components/AgentConfigPanel.tsx)
- **추가 필드**:
  1. `Process ID (PID)`: 텍스트 입력창.
  2. `Thread ID (TID)`: 텍스트 입력창.
  3. `User Hint (주관식)`: 멀티라인 텍스트 영역(TextArea).
- **레이아웃**: 로그 파일 리스트 바로 아래에 정갈하게 배치합니다.
- **데이터 전달**: `onStart` 콜백의 매개변수에 위 3가지 값을 추가합니다.

### 2. 분석 로직 개선 (Analysis Agent Hook)

#### [MODIFY] [useAnalysisAgent.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/LogAnalysisAgent/hooks/useAnalysisAgent.ts)
- **인터페이스 확장**: `startAnalysis`가 `userHints: { pid: string, tid: string, custom: string }` 정보를 추가로 받도록 수정합니다.
- **힌트 빌드**: `allHints` 문자열을 생성할 때 사용자가 입력한 힌트들을 최상단에 `[USER HINT]` 태그와 함께 추가합니다.

---

## Verification Plan

### Manual Verification
1. 2개 이상의 로그 파일을 업로드합니다.
2. 분석 유형과 미션을 선택합니다.
3. PID(예: 1234), TID(예: 5678), 주관식 힌트(예: "앱 실행 후 3초 뒤에 프리징 발생")를 입력합니다.
4. '분석 시작'을 누르고 에이전트의 첫 번째 `thought`에서 입력한 힌트들을 언급하는지 확인합니다. (디버그 패널에서 `initial_hints` 원본도 확인 가능)

---
형님, 이 계획대로 "정밀 힌트" 장착 가도 될까요? **Proceed** 혹은 **"고고"** 해주시면 바로 작업 들어갑니다! 🐧🔥🛠️🚀
