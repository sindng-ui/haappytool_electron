# HappyTool APP_MAP (AI 작업 지도) 🗺️

형님! 이 지도는 AI Agent가 프로젝트의 기능을 즉시 찾고 분석할 수 있도록 돕는 **인터페이스 규격 기반의 지도**입니다. 🐧⚡
모든 경로는 **프로젝트 베이스 기준 상대 경로**를 사용하며, 한글/영어 키워드 매핑을 통해 검색 효율을 극대화했습니다.

---

## 1. Global Layout & System Architecture
전체 앱의 뼈대와 플러그인 시스템의 연결 고리입니다.

### [[Global Entry Point]]
- **ID**: `global-entry-app`
- **Keywords**: [`진입점`, `entry`, `main`, `app root`, `초기화`, `iife worker`, `sandbox false`]
- **Tech Spec**:
  - **빌드 시스템**: Vite 6 (Worker format: IIFE로 번들링하여 생산 빌드 호환성 확보) [UPDATED]
  - **데스크톱 프레임워크**: Electron 39 (Sandbox: false, SharedArrayBuffer 활성화) [UPDATED]
- **Location**:
  - `Html`: [index.html](./index.html) (Vite Entry Point)
  - `View`: [App.tsx](./App.tsx)
  - `Config`: [index.tsx](./index.tsx)
- **Core Interface**:
  - `AppContent`: 전역 상태(Settings, Plugin 등) 관리의 핵심 컴포넌트
  - `HappyToolProvider`: 전역 Context 공급
  - `LoadingSplash`: **터미널 스타일(Terminal Style)**의 실시간 시스템 로그 배경이 적용된 프리미엄 로딩 화면. 폰트 크기 최적화(`text-2xl`)를 통해 시작 로그의 가독성과 노출량을 극대화함. [UPDATED]
- **Startup UX Optimization**:
  - `Fake Progress`: 서버 기동 시 0->95%까지 서서히 증가하여 대기 시간 시각화 (`main.cjs`)
  - `Progress Creep`: 플러그인 로드 대기 시 98->99.9%까지 점진적으로 증가하여 활동성 확보 (`LoadingSplash.tsx`)
  - `Log Streaming`: 부팅 로그 필터 완화로 실시간 초기화 과정 노출 (`main.cjs` console override)
- **Data Flow**: `localStorage` -> `Settings Load` -> `Context State` -> `Plugin Injection`

### [[Plugin Registry & Injection]]
- **ID**: `system-plugin-registry`
- **Keywords**: [`플러그인 등록`, `plugin load`, `registry`, `wrapper`]
- **Location**:
  - `Registry`: [registry.ts](./plugins/registry.ts)
  - `Types`: [types.ts](./plugins/types.ts)
  - `Container`: [PluginContainer.tsx](./components/PluginContainer.tsx)
- **Core Interface**:
  - `ALL_PLUGINS`: 등록된 모든 플러그인 배열 (순서 조정 가능)
  - `HappyPlugin`: 플러그인 규격 인터페이스
- **Data Flow**: `registry.ts` -> `App.tsx` -> `Sidebar` & `PluginContainer`

### [[Sidebar Navigation]]
- **ID**: `ui-sidebar-nav`
- **Keywords**: [`사이드바`, `메뉴`, `navigation`, `tool switch`]
- **Location**:
  - `View`: [Sidebar.tsx](./components/Sidebar.tsx)
- **Interactions**:
  - `Click`: 플러그인 전환 (`setActiveTool`)
  - `Drag & Drop`: 플러그인 아이콘 순서 변경 (Reorder)

### [[Headless CLI Infrastructure]] 🐧💻
- **ID**: `system-headless-cli`
- **Keywords**: [`CLI`, `Headless`, `Automated Test`, `Background Execution`, `commander`, `hidden window`, `fallback`]
- **Location**:
  - `Main Entry`: [cli.cjs](./electron/cli.cjs)
  - `Main Process`: [main.cjs](./electron/main.cjs)
  - `Renderer UI`: [CliApp.tsx](./CliApp.tsx)
  - `Renderer Logic Hook`: [useCliHandlers.ts](./hooks/useCliHandlers.ts)
- **Core Interface**:
  - `runCli(args)`: 커맨드라인 매개변수 파싱 및 Headless(Hidden) BrowserWindow 생성
  - **연결 안정화**: Vite 서버 대기 시 5초 타임아웃 및 `app://` 프로토콜(빌드 파일) 자동 Fallback 로직 탑재 [NEW]
  - `CliApp`: CLI 렌더러 진입점. 500줄 초과 방지를 위해 핵심 커맨드 핸들러를 별도 훅으로 위임.
  - `useCliHandlers`: `analyze-diff`, `log-extractor` 등 실제 커맨드 처리 오케스트레이션 훅 [REFACTORED]
- **Data Flow**: `Terminal Argv` -> `commander (cli.cjs)` -> `BrowserWindow (Hidden)` -> `CliApp.tsx` -> `useCliHandlers.ts` -> `Task Execution` -> `Terminal Output`

---

## 2. Core Feature: Log Extractor
대용량 로그 분석의 핵심 엔진과 UI입니다.

### [[Log Extractor Engine]]
- **ID**: `logic-log-extractor-core`
- **Keywords**: [`필터링`, `인덱싱`, `바이너리 저장소`, `SharedArrayBuffer`, `filtering`, `indexing`, `applyFilter`, `logBuffer`, `WASM`]
- **Location**:
  - `Main Logic`: [useLogExtractorLogic.ts](./hooks/useLogExtractorLogic.ts)
  - `Worker`: [LogProcessor.worker.ts](./workers/LogProcessor.worker.ts) (중앙 제어)
  - `Filter Sub`: [LogFilterSub.worker.ts](./workers/LogFilterSub.worker.ts) (병렬 필터링)
  - `WASM Engine`: [src-wasm/](./src-wasm/)
  - `Data Reader`: [workerDataReader.ts](./workers/workerDataReader.ts)
- **Core Interface**:
  - `applyFilter(rule, quickFilter)`: 필터링 요청 트리거
  - `buildFileIndex(file)`: 파일 초기 인덱싱 스캔
  - `filteredIndices`: 필터링된 결과 라인 번호 배열 (Int32Array)
- **Optimizations**:
  - `SharedArrayBuffer Zero-copy Binary Read`: UI(HyperLogRenderer)에서 직접 공유 메모리를 읽어 렌더링 성능 극대화.
  - `ANSI Stripping`: 로딩 시점에서 ANSI 코드를 제거하여 부하 최소화.
  - `Lazy SAB Allocation`: 로컬 파일 모드 시 메모리 할당 지연 (RAM 절약).
  - `Active State Sync`: 백그라운드 탭의 유령 워커 자동 정리. [NEW]
- **Lifecycle & Reliability** 🐧🛡️:
  - `Worker ID`: 각 워커 생성 시 고유 ID 부여하여 로그 가독성 개선.
  - `Mount Cycle Safety`: 언마운트 시 로딩 경로 캐시 강제 초기화로 로딩 누락 원천 차단.
  - `Worker Persistence`: `LogWorkerRegistry`를 통해 탭 재마운트 시 즉각적인 UI 복구 및 재인덱싱 방지.
  - `Worker Idempotency`: 동일 파일에 대한 중복 로딩 요청 무시.
- **Data Flow**: Log Worker(Main) ↔ Log Worker(Sub/WASM) ↔ UI (Binary Read)

### [[Log Viewer UI Architecture]]
- **ID**: `ui-log-viewer-hierarchy`
- **Keywords**: [`로그 뷰어`, `렌더러`, virtual scroll`, virtual virtual`, `Pane`, `HyperLogRenderer`, `Raw Context`]
- **Location**:
  - `Container`: [LogSession.tsx](./components/LogSession.tsx)
  - `Pane`: [LogViewerPane.tsx](./components/LogViewer/LogViewerPane.tsx)
  - `Renderer`: [HyperLogRenderer.tsx](./components/LogViewer/HyperLogRenderer.tsx)
  - `RawContextViewer`: 로그 라인 더블 클릭 시 원본 로그 문맥 오버레이. [NEW]
- **Interactions**:
  - `Space`: 북마크 토글 (황금색 언더라인 강조) [MOD]
  - `Double Click`: 원본 로그 문맥(Raw Context) 보기 [MOD]
  - **LLM Communication 디버깅 강화**: URL, Method, Headers, Full Body를 포함한 전체 HTTP 트래픽 기록 및 UI 표시. 긴 텍스트 자동 요약(Truncation) 적용. [NEW]
  - **AI 통신 디버그 로깅**: AI와 주고받는 모든 Raw 통신 데이터를 `agent_traffic_debug.log` 파일에 기록 (현재 비활성화, `agentApiService.ts`에서 활성 가능). [UPDATED]
  - **AI 분석 루프 최적화**: 중복 실행 방지 가드 및 정체(Stall) 감지 로직 추가. 정체 및 API 오류 발생 시에도 통신 로그를 남기도록 개선. [UPDATED]
  - **Gauss 에이전트 호환성 강화**: `outputs.message` 등 다양한 응답 규격 추가 대응. [NEW]
  - **AI 요청 데이터 시각화**: 분석 중 어떤 힌트와 로그 데이터가 LLM으로 전송되었는지 실시간 요약 표시. [NEW]
  - **라인 넘버 토글**: # 인덱스와 원본 라인 번호 선택적 숨김 기능. [NEW]
  - **스플릿 뷰 스마트 스텝**: `Ctrl + Shift + Arrow`를 통한 0.1/0.5/0.9 비율 조절. [NEW]

### [[NetTraffic Analyzer]] 🐧⚡ [CORE]
- **ID**: `NET_TRAFFIC_ANALYZER`
- **Keywords**: [`네트워크`, `트래픽`, `URI 정규화`, `UA 분석`, `Compare View`, `Markdown Copy`, `Raw Log Jump`]
- **Location**:
  - `View`: [NetTrafficAnalyzerView.tsx](./components/NetTrafficAnalyzer/NetTrafficAnalyzerView.tsx)
  - `Compare View`: [NetTrafficCompareView.tsx](./components/NetTrafficAnalyzer/NetTrafficCompareView.tsx)
  - `Worker`: [NetTraffic.worker.ts](./workers/NetTraffic.worker.ts)
  - `Compare UI`: [CompareEndpointTable.tsx](./components/NetTrafficAnalyzer/CompareEndpointTable.tsx)
- **Features**:
  - **Diff Analytics**: 트래픽 증감(+/-), 신규 엔드포인트(NEW) 자동 정렬 및 시각화.
  - **Raw View 연동**: 상세 항목 클릭 시 참조 로그의 원본 위치로 즉시 점프.
  - **CLI 지원**: `npm run cli -- nettraffic`을 통한 JSON 리포트 생성. [NEW]

---

## 3. Major Plugins (주요 플러그인)
검증된 안정성과 높은 사용 빈도를 가진 핵심 도구들입니다.

### [[Log Analysis Agent]] 🧠💎 [NEW]
- **ID**: `LOG_ANALYSIS_AGENT`
- **Keywords**: [`AI Agent`, `Crash 분석`, `HAPPY-MCP`, `Gemini`, `Gauss 2.3 Think`, `드래그바`, `Action 요약`]
- **Location**:
  - `View`: [index.tsx](./plugins/LogAnalysisAgent/index.tsx)
  - `Hook`: [useAnalysisAgent.ts](./plugins/LogAnalysisAgent/hooks/useAnalysisAgent.ts)
  - `Service`: [agentApiService.ts](./plugins/LogAnalysisAgent/services/agentApiService.ts)
- **Features**:
  - **Global Auth SDB Helper**: `vconftool` 명령어를 통해 단말의 `accessToken`을 자동으로 파싱하여 Bearer Token 필드에 입력하는 기능. [NEW]
  - **다중 로그 파일 분석 (합산 힌트)**: 여러 로그 파일을 동시 드롭하여 통합 분석. [NEW]
  - **Premium 2-Tab Layout**: 'Analysis'와 'LLM Communication' 2개 상시 탭 구조 도입. [UPDATED][HOT]
  - **통합 분석 뷰 (Unified Analysis)**: 실시간 과정(Thought)과 최종 리포트(Final Report)를 하나의 스크롤 뷰에 통합. [UPDATED]
  - **상시 디버그 모니터 (Live Communication)**: 별도 토글 없이 LLM과의 Raw Traffic을 상시 확인 가능. [UPDATED]
  - **사용자 맞춤형 힌트 (Detailed Context)**: 분석 시작 전 PID, TID, 주관식 힌트 입력 기능.
  - **AI 응답 자동 포맷팅**: Thought 및 최종 보고서가 JSON으로 응답될 경우 자동으로 핵심 텍스트를 추출하고 보기 좋게 포맷팅하여 표시. [NEW]
  - **Gauss 2.3 Think 통합**: `agent.sec.samsung.net` 엔드포인트 최적화.
  - **드래그 가능한 타이틀 바**: 프레임리스 환경에서도 상단 `h-9` 영역을 통한 창 이동 지원.
  - **성능 최적화 (UI Stability)**: `React.memo`, `useCallback`, `useMemo`를 통한 리렌더링 최소화 및 컨텍스트 상위 이동(Context Uplift)을 통해 사이드바 애니메이션 시 버벅임 방지. [UPDATED][HOT]

### [[Gauss Chat Plugin]] 💬 [NEW]
- **ID**: `GAUSS_CHAT_AGENT`
- **Keywords**: [`Gauss Chat`, `Streaming`, `Debug Panel`, `Raw Response`]
- **Location**:
  - `View`: [GaussChatAgent/index.tsx](./plugins/GaussChatAgent/index.tsx)
  - `Service`: [GaussChatService.ts](./plugins/GaussChatAgent/GaussChatService.ts)
- **Features**:
  - **실시간 스트리밍**: 가우스 2.3 Think 모델의 실시간 응답 표시.
  - **디버그 패널**: 우측 상단 `SHOW DEBUG` 버튼을 통해 raw JSON/SSE 정밀 모니터링 가능. (너비 450px 고정) [NEW]

### [[SpeedScope Plugin]]
- **ID**: `plugin-speedscope`
- **Keywords**: [`SpeedScope`, `Flame Graph`, `Performance`, `Main Thread Detection`]
- **Location**:
  - `View`: [SpeedScopePlugin.tsx](./components/SpeedScope/SpeedScopePlugin.tsx)
  - `Worker`: [SpeedScopeParser.worker.ts](./workers/SpeedScopeParser.worker.ts)
- **Features**:
  - **메인 스레드 자동 탐지**: PID 및 메타데이터 정보를 분석하여 최적의 프로파일 자동 식별. [UPDATED]
  - **Analyze Diff**: 두 JSON 프로파일 간 성능 차이 분석 및 시각화.

### [[BlockTest Plugin]]
- **ID**: `plugin-block-test`
- **Keywords**: [`BlockTest`, `Scenario`, `Pipeline`, `Automation`, `Graph View`]
- **Features**:
  - **그래프 뷰 기본화**: 시각적 흐름 파악을 위한 Graph View 레이아웃 기본 적용. [HOT]
  - **CLI 연동**: Headless 모드에서도 시나리오/파이프라인 실행 지원.

---

## 4. Shared Services & Infrastructure

### [[ESM Compatibility Management]] 📦 [NEW]
- **ID**: `system-esm-compatibility`
- **Keywords**: [`react-markdown`, `Vite build`, `Rollup`, `resolve alias`]
- **Location**: [vite.config.ts](./vite.config.ts)
- **Fix**: Pure ESM 패키지(`react-markdown` 등)의 빌드 오류 해결을 위한 `node_modules` 경로 강제 매핑 및 사전 번들링 설정.

### [[Build Cleanup Utility]] 🛠️
- **ID**: `tool-build-cleanup`
- **Keywords**: [`build cleanup`, `taskkill`, `process lock`]
- **Location**: [scripts/cleanup_build.cjs](./scripts/cleanup_build.cjs)
- **Fix**: 빌드 전 프로세스 강제 종료 및 잔여 파일 정리로 빌드 안정성 확보.

---

## 5. Maintenance & Policy

### [[500 Lines Rule]] 👮
- 한 파일이 500줄을 초과할 경우 즉시 리팩토링 및 컴포넌트 분리를 계획하여 제출합니다.

### [[Performance First]] 🚀
- 대용량 데이터 처리 시 무조건 워커(Worker)를 동원하고, 메모이제이션을 통해 UI 부하를 최소화합니다.

---

> [!TIP]
> **형님, 지도가 하나로 완벽하게 합쳐졌습니다!** 이제 `important/APP_MAP.md` 하나만 믿고 따라오시면 됩니다! 🐧🚀🛡️
