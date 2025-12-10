# HappyTool Project Overview

## 1. Core Design Decisions (핵심 디자인 결정)

### A. State Management & Architecture
- **Separation of Concerns (관심사 분리)**: 
  - UI 렌더링 (`LogExtractorLayout`), 비즈니스 로직 (`useLogExtractorLogic`), 상태 공유 (`LogContext`)를 명확히 분리하여 `LogExtractor` 컴포넌트의 복잡도를 획기적으로 낮췄습니다.
  - **Context API 도입**: 깊은 Prop Drilling 문제를 해결하기 위해 `LogContext`를 도입, `ConfigurationPanel`이나 `TopBar` 같은 하위 컴포넌트가 필요한 상태에 직접 접근하도록 설계했습니다.

### B. Performance Optimization
- **Web Worker**: 대용량 로그 파싱 및 필터링 작업을 메인 스레드에서 분리하여 `LogProcessor.worker.ts`에서 처리, UI 블로킹을 방지했습니다.
- **Custom Virtual Scrolling**: 외부 라이브러리 의존성 없이 `LogViewerPane`에 커스텀 가상 스크롤을 구현하여 수백만 줄의 로그도 부드럽게 렌더링합니다. 최근 `LogLine` 컴포넌트 분리 및 `React.memo` 적용으로 렌더링 성능을 더욱 강화했습니다.

### C. Component Modularization
- **Common UI System**: `components/ui` 폴더에 `Button`, `IconButton` 등 재사용 가능한 컴포넌트를 구축하여 UI 일관성을 확보하고 코드 중복을 줄였습니다.
- **Feature Modules**: `JsonTools`, `PostTool` 등 주요 기능을 독립적인 컴포넌트 및 서브 컴포넌트로 분할하여 유지보수성을 높였습니다.

## 2. Key Codebase Areas (주요 코드베이스 영역)

### Log Analysis (`components/LogExtractor.tsx` & `components/LogViewer/`)
- **`hooks/useLogExtractorLogic.ts`**: 파일 로드, 필터링, 검색, 워커 통신 등 모든 핵심 비즈니스 로직이 집약된 Custom Hook.
- **`manifests/LogContext.tsx`**: `LogExtractor` 전역 상태를 공급하는 Context Provider.
- **`LogViewerPane.tsx`**: 가상 스크롤 및 로그 렌더링을 담당하는 핵심 뷰어.
- **`ConfigurationPanel.tsx`**: 필터링 규칙, 하이라이팅 설정 등을 관리하는 패널 (Context 기반).

### Utilities
- **`components/JsonTools/`**: JSON 포맷터 및 Diff 뷰어.
- **`components/PostTool/`**: HTTP 요청/응답 테스트 도구.
- **`types.ts`**: 프로젝트 전반에 사용되는 TypeScript 타입 정의.

## 3. Remaining Tasks (남은 할 일 & 개선 사항)

### Pending Implementations
- **TpkExtractor 고도화**: 현재 TPK 파일 추출 기능의 구체적인 구현이나 개선이 필요할 수 있습니다.
- **System Testing**: 리팩토링된 Hook 및 Worker 로직에 대한 유닛 테스트 및 통합 테스트 작성.

### Future Improvements
- **Electron IPC Optimization**: 초대용량 파일(수 GB) 처리 시 메모리 효율성을 위한 스트리밍 방식 파일 읽기 도입 검토.
- **User Customization**: 단축키 설정, 테마 커스터마이징 기능 추가.
- **Log Parsing Engine**: 정규식 외에 다양한 로그 포맷(JSON 로그 등)에 대한 구조적 파싱 지원 확장.
