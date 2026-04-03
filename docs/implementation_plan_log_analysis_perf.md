# 로그 분석 에이전트 성능 최적화 계획 (Stuttering 제거) 🐧⚡

형님, 로그 분석 에이전트 사이드바가 열리고 닫힐 때나 분석 중에 버벅이는 현상을 잡기 위한 정밀 최적화 계획입니다. 핵심은 **React.memo가 제 역할을 못하게 방해하는 요소들을 제거**하는 것입니다.

## User Review Required

> [!IMPORTANT]
> **성능 저하의 핵심 원인**:
> 1. **인라인 함수 (Inline Callbacks)**: `index.tsx`에서 `AgentConfigPanel`과 `AgentThoughtStream`에 함수를 전달할 때 `() => ...` 형태의 인라인 함수를 사용하여, 매번 새로운 참조가 생성되었습니다. 이로 인해 `React.memo`가 무용지물이 되고 있었습니다.
> 2. **Context 과다 구독 (Context Over-subscription)**: `AgentConfigPanel` 내부에서 `useHappyTool()`을 직접 호출하고 있습니다. 전역 컨텍스트(HappyToolContext)의 다른 값(예: `ambientMood`)만 바뀌어도 설정 패널 전체가 리렌더링되는 비효율이 있었습니다.

## Proposed Changes

### 1. Log Analysis Agent Entry Point (`LogAnalysisAgent/index.tsx`)
- 모든 이벤트 핸들러(`onStart`, `onCancel`, `onReset`, `onAnswerUserQuery`)를 `useCallback`으로 감싸서 메모이제이션합니다.
- `useHappyTool()`에서 `logRules`를 직접 추출하여 자식 컴포넌트에 prop으로 전달합니다.
- 인라인 함수를 제거하여 `React.memo` 효과를 극대화합니다.

### 2. Agent Configuration Panel (`AgentConfigPanel.tsx`)
- 내부의 `useHappyTool()` 구독을 제거하고, 부모로부터 `logRules`를 주입받는 방식으로 변경합니다.
- 이를 통해 전역 상태 변화로부터 독립적인 렌더링 성능을 확보합니다.

### 3. Thought Stream & Debug Item (`index.tsx` 및 `AgentThoughtStream.tsx`)
- `iterations` 맵핑 시 발생하는 불필요한 계산을 점검하고, 리렌더링 범위를 최소화합니다.

---

## 작업 파일 상세

#### [MODIFY] [index.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/LogAnalysisAgent/index.tsx)
- `useCallback` 도입 및 인라인 핸들러 제거
- `logRules` prop 전달 로직 추가

#### [MODIFY] [AgentConfigPanel.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/LogAnalysisAgent/components/AgentConfigPanel.tsx)
- `useHappyTool` 제거 및 `logRules` interface/props 추가

#### [MODIFY] [useAnalysisAgent.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/LogAnalysisAgent/hooks/useAnalysisAgent.ts)
- `startAnalysis` 등의 함수가 완벽하게 메모이제이션되어 있는지 재검토 (이미 되어 있으나 의존성 체크)

---

## Verification Plan

### Manual Verification
1. **사이드바 애니메이션 테스트**: 사이드바를 열고 닫을 때 `Log Analysis Agent` UI가 부드럽게 유지되는지 확인합니다.
2. **분석 중 UI 반응성**: 실시간으로 `Thought`가 업데이트되는 동안 탭 전환이나 설정 변경이 지연 없이 일어나는지 확인합니다.
3. **React DevTools 점검**: 불필요한 리렌더링이 발생하지 않는지 프로파일러로 최종 확인합니다.

형님, 이 정도면 버벅임 없이 쾌적하게 쓰실 수 있을 겁니다! **Proceed** 혹은 **"가자"**라고 말씀해 주시면 바로 작업 시작하겠습니다! 🐧🔥🚀
