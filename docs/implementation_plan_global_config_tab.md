# Implementation Plan - Configuration 탭 상태 전역화 🌐

형님! 로그 익스트랙터에서 여러 탭을 오갈 때 Configuration 패널의 "Settings | Commands" 선택이 초기화되지 않고 유지되도록 개선하겠습니다. 
이를 위해 로컬 상태(`useState`)로 관리되던 `activeTab`을 전역 컨텍스트(`HappyToolContext`)로 이동시키겠습니다!

## 1. 수정 사항

### A. `HappyToolContext` 확장
- `configActiveTab` ('settings' | 'commands') 상태와 이를 업데이트하는 `setConfigActiveTab` 함수를 전역 컨텍스트에 추가합니다.

### B. `App.tsx` (전역 관리자) 수정
- 앱 실행 시 `localStorage`에서 마지막으로 선택했던 탭 상태를 불러와 초기화합니다.
- 탭 선택이 변경될 때마다 `localStorage`에 저장하여 세션이 바뀌어도 유지되도록 합니다.
- 전역 컨텍스트 공급자(`HappyToolProvider`)에 새로운 상태를 전달합니다.

### C. `ConfigurationPanel.tsx` 수정
- 자체적으로 관리하던 `activeTab` 상태를 제거하고, `useHappyTool` 훅을 통해 전역 상태를 사용하도록 변경합니다.
- 이제 어떤 로그 탭에서도 동일한 전역 상태를 공유하게 되므로, 탭 전환 시에도 선택된 설정 화면이 유지됩니다.

## 2. 세부 작업 단계

1. `contexts/HappyToolContext.tsx` 파일 수정
   - `HappyToolContextType` 인터페이스에 `configActiveTab`, `setConfigActiveTab` 추가

2. `App.tsx` 파일 수정
   - 전역 상태 정의 및 `localStorage` 연동 로직 추가
   - 컨텍스트 밸류에 새로운 상태 포함

3. `components/LogViewer/ConfigurationPanel.tsx` 파일 수정
   - 로컬 `useState` 제거 및 `useHappyTool` 연동
   - 기존 `activeTab` 참조 로직을 전역 상태 참조로 교체

형님, 이 계획대로 진행해서 탭 전환 시에도 불편함 없게 만들어드리겠습니다! 🐧🚀
