# 구현 계획서: 글로벌 로그 뷰어 줌 동기화

형님, 로그 탭마다 따로 노는 줌 설정을 하나로 묶어서 어디서든 조절하면 싹 다 바뀌게 만들겠습니다! 🐧✨

## 🎯 목표
- [x] 로그 뷰어의 폰트 크기(`fontSize`)와 줄 높이(`rowHeight`)를 전역 상태로 관리
- [x] 한 탭에서 `Ctrl + Wheel` 조절 시 모든 탭에 즉시 반영
- [x] 설정 변경 시 `localStorage`에 자동 저장하여 세션 유지
- [x] 기존 `useLogViewPreferences` 훅의 인터페이스를 유지하여 사이드 이펙트 최소화

## 🛠️ 작업 단계

### 1. 전역 컨텍스트 생성 (`components/LogViewer/LogViewPreferencesContext.tsx`)
- `useLogViewPreferences.ts`에 있던 상태 관리 로직을 컨텍스트 프로바이더로 이전합니다.
- `logViewPreferences`, `handleZoomIn`, `handleZoomOut` 등을 포함합니다.

### 2. 훅 리팩토링 (`hooks/useLogViewPreferences.ts`)
- 기존에 각자 `useState`를 쓰던 방식에서 `useContext`를 사용하는 방식으로 변경합니다.
- 이 훅을 사용하는 모든 컴포넌트(`LogSession`, `LogViewerPane` 등)가 자동으로 전역 상태를 보게 됩니다.

### 3. 프로바이더 주입 (`components/LogExtractor.tsx`)
- `LogExtractor` 컴포넌트 내부에서 모든 `LogProvider`를 `LogViewPreferencesProvider`로 감쌉니다.

### 4. 검증 및 최적화
- `LogSession.tsx`의 휠 이벤트 리스너가 전역 상태를 잘 업데이트하는지 확인합니다.
- 탭 전환 시에도 줌 레벨이 일정하게 유지되는지 체크합니다.

## ⚠️ 주의사항
- `isActive` 상태일 때만 휠 이벤트가 작동하도록 기존 로직을 유지하여, 다른 도구(Dashboard 등)와의 충돌을 방지합니다.
- 성능을 위해 `localStorage` 저장은 기존처럼 효율적으로 처리합니다.

형님, 준비되셨으면 **Proceed** 버튼을 눌러주십쇼! 바로 작업 들어갑니다! 🚀
