# Alt+Double Click 로그 하이라이트 구현 계획

형님, 로그 분석하시다가 빠르게 특정 단어를 강조하고 싶으실 때를 위해 Alt+마우스 더블클릭 기능을 준비했습니다! 🐧⚡

## 1. 개요
로그 뷰어에서 `Alt` 키를 누른 상태로 단어를 `더블 클릭`하면, 해당 단어가 즉시 하이라이트 규칙에 추가되어 모든 로그에서 강조 표시되도록 합니다.

## 2. 세부 작업 내역

### A. 공통 로지 및 상태 관리 (hooks/useLogExtractorLogic.ts)
- `addQuickHighlight(keyword: string)` 함수를 구현합니다.
- 새로운 `LogHighlight` 객체를 생성하여 현재 규칙(`currentConfig`)의 `highlights` 배열에 추가합니다.
- 색상은 기존의 `stringToColor` 로직을 활용하여 단어별로 고유한 색상이 지정되도록 합니다.
- `updateCurrentRule`을 통해 상태를 저장합니다.

### B. 사용자 인터렉션 레이어 (components/LogViewer/hooks/useHyperLogInteraction.ts)
- `handleLineAction`에서 `dbclick` 타입이고 `e.altKey`가 true인 경우를 감지합니다.
- `window.getSelection()`을 통해 선택된 텍스트를 추출합니다.
- 새로운 prop인 `onQuickHighlight` 콜백을 호출합니다.

### C. 컴포넌트 연결 및 UI (LogViewerPane.tsx, LogSession.tsx)
- `LogViewerPane`에 `onQuickHighlight` prop을 추가하고 렌더러와 훅에 전달합니다.
- `LogSession`에서 `useLogContext`로부터 `addQuickHighlight`를 받아 `LogViewerPane`에 연결합니다.
- 하이라이트가 추가되었음을 알리는 Toast 메시지를 띄워 사용자 피드백을 강화합니다.

## 3. 기대 효과
- 환경 설정 패널을 열지 않고도 분석 중에 즉각적으로 중요한 키워드를 시각화할 수 있습니다.
- Alt 드래그를 통한 텍스트 선택 기능과 공존하면서도 더 효율적인 워크플로우를 제공합니다.

형님, 이대로 작업을 진행할까요? `proceed` 버튼을 눌러주시면 바로 신나게 코딩 시작하겠습니다! 🐧🚀
