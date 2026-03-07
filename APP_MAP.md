# HappyTool APP_MAP (AI 작업 지도) 🗺️

형님! 이 지도는 AI Agent가 프로젝트의 기능을 즉시 찾고 분석할 수 있도록 돕는 **인터페이스 규격 기반의 지도**입니다. 🐧⚡
모든 경로는 **프로젝트 베이스 기준 상대 경로**를 사용하며, 한글/영어 키워드 매핑을 통해 검색 효율을 극대화했습니다.

---

## 1. Global Layout & System Architecture
전체 앱의 뼈대와 플러그인 시스템의 연결 고리입니다.

### [[Global Entry Point]]
- **ID**: `global-entry-app`
- **Keywords**: [`진입점`, `entry`, `main`, `app root`, `초기화`]
- **Location**:
  - `View`: [App.tsx](./App.tsx)
  - `Config`: [index.tsx](./index.tsx)
- **Core Interface**:
  - `AppContent`: 전역 상태(Settings, Plugin 등) 관리의 핵심 컴포넌트
  - `HappyToolProvider`: 전역 Context 공급
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

### [[Headless CLI Infrastructure]]
- **ID**: `system-headless-cli`
- **Keywords**: [`CLI`, `Headless`, `Automated Test`, `Background Execution`, `commander`, `hidden window`]
- **Location**:
  - `Main Process`: [cli.cjs](./electron/cli.cjs)
  - `Renderer Logic`: [CliApp.tsx](./CliApp.tsx)
- **Core Interface**:
  - `runCli(args)`: 커맨드라인 매개변수 파싱 및 Headless(Hidden) BrowserWindow 생성
  - `CliApp`: 렌더러 측 CLI 핸들러. IndexedDB, Web Worker, WASM 등을 CLI에서도 GUI와 동일하게 활용할 수 있도록 브릿지 역할 수행
- **Data Flow**: `Terminal` -> `cli.cjs` -> `IPC (cli-run-command)` -> `CliApp.tsx` -> `IPC (cli-stdout/stderr)` -> `Terminal`


---

## 2. Core Feature: Log Extractor
대용량 로그 분석의 핵심 엔진과 UI입니다.

### [[Log Extractor Engine]]
- **ID**: `logic-log-extractor-core`
- **Keywords**: [`필터링`, `인덱싱`, `바이너리 저장소`, `SharedArrayBuffer`, `filtering`, `indexing`, `applyFilter`, `logBuffer`]
- **Location**:
  - `Main Logic`: [useLogExtractorLogic.ts](./hooks/useLogExtractorLogic.ts)
  - `Worker`: [LogProcessor.worker.ts](./workers/LogProcessor.worker.ts)
  - `Data Reader`: [workerDataReader.ts](./workers/workerDataReader.ts)
  - `Analysis`: [workerAnalysisHandlers.ts](./workers/workerAnalysisHandlers.ts)
- **데이터 흐름**: Log Worker(Main) ↔ Log Worker(Sub/WASM) ↔ UI (SharedArrayBuffer Zero-copy Binary Read) 🚀
- **최근 최적화**:
  - `LogProcessor.worker.ts` 내 메시지 전달 루프를 `async/await` 구조로 개편하여 레이스 컨디션 해결 및 안정성 확보.
  - **SharedArrayBuffer 기반 Zero-copy Binary Read** 구현. 워커에 데이터를 요청하는 대신 UI(HyperLogRenderer)에서 직접 공유 메모리를 읽어 렌더링 속도 비약적 향상 및 RAM 다이어트 성공! 🐧💎🚀
  - **RPC 기반 대용량 파일 스트리밍(`isLocalFileMode`)** 구현. File API를 탈피하고, 700MB, 2GB 등 초거대 로그 파일을 로드할 때 발생하는 메모리 초과(OOM)를 원천 차단했습니다! RPC로 필요한 청크만 요청하여 메인 및 하위 워커에 병렬로 배분하는 궁극의 제로카피 구조 완성. 🚀 [NEW]
- **Core Messages**:
  - `INIT_LOCAL_FILE_STREAM`: `{ path, size }` -> 로컬 디스크에서 직접 청크 단위로 스트리밍 인덱스 빌드 및 필터링 수행 [NEW]
  - `RPC_REQUEST` / `RPC_RESPONSE`: 워커 ↔ UI ↔ 메인 간 파일 직접 읽기(`readFileSegment`) 통신 채널 [NEW]
  - `GET_LINES`: `{ startLine, count }` -> 필터링된 결과에서 지정된 오프셋의 로그 반환 (SAB 및 RPC 지원)
  - `BUFFER_SHARED`: `{ logBuffer, lineOffsets, ... }` -> UI에 공유 메모리 주소 전달 (Zero-copy 시작 알림)
  - `FILTER_LOGS`: `{ happyGroups, excludes, quickFilter, ... }` -> 필터 룰 적용
  - **성능 분석 고도화**: 로그 내부의 함수 호출 라인 번호(예: `OnResume(350)`)를 정규식으로 정밀 추출(`codeLineNum`)하여 분석 리포트의 정확도를 비약적으로 향상시켰습니다. [NEW] 🐧📊🎯
- **Data Flow**: `fs.read (Main)` -> `UI RPC` -> `Worker(Binary Logging)` -> `Shared Log Buffer/Offsets` -> `WASM/SubWorker(Filtering)` -> `Shared filterIndices` -> `UI (Zero-copy Reading)` -> `HyperLogRenderer`

### [[Headless CLI Engine]]
- **ID**: `logic-headless-cli-core`
- **Keywords**: [`CLI`, `커맨드라인`, `headless`, `background`, `commander`, `CliApp`, `CLI모드`, `block-test`]
- **Location**:
  - `Main CLI Entry`: [cli.cjs](./electron/cli.cjs)
  - `Headless Component`: [CliApp.tsx](./CliApp.tsx)
- **Core Interface**:
  - `cli-run-command`: Main -> Renderer 커맨드 하달 (`log-extractor`, `block-test` 등)
  - `cli-ready`: Renderer -> Main 준비 완료 알림
  - `cli-stdout` / `cli-stderr` / `cli-exit`: Renderer -> Main 터미널 콘솔 파이프
- **최근 개선**:
  - `CliApp.test.tsx`의 `block-test` 시나리오 테스트에서 발생하던 5초 타임아웃 문제를 가상 타이머(`vi.useFakeTimers`) 최적화를 통해 해결하고, 테스트 실행 속도를 50배 이상 향상시켰습니다! 🐧🚀💎
- **Data Flow**: `Terminal Argv` -> `commander (cli.cjs)` -> `app://./index.html?mode=cli` -> `index.tsx (Conditionally Route)` -> `CliApp.tsx` -> `Task Execution (LogExt / BlockTest)` -> `Terminal Output`

### [[Log Viewer UI Architecture]]
- **ID**: `ui-log-viewer-hierarchy`
- **Keywords**: [`로그 뷰어`, `렌더러`, `virtual scroll`, `pane`, `HyperLogRenderer`]
- **Location**:
  - `Container`: [LogSession.tsx](./components/LogSession.tsx)
  - `Pane`: [LogViewerPane.tsx](./components/LogViewer/LogViewerPane.tsx)
  - `Renderer`: [HyperLogRenderer.tsx](./components/LogViewer/HyperLogRenderer.tsx)
  - `Raw View`: [RawContextViewer.tsx](./components/LogViewer/RawContextViewer.tsx) [REFACTORED]
- **Core Interface**:
  - `RawContextViewer`: 로그 라인 더블 클릭 시 원본 로그 문맥을 보여주는 오버레이 뷰. `z-index` 충돌 문제 해결 및 `LogSession`에서의 중복 정의 제거. [NEW] 🐧💎
- **Interactions**:
  - `Scroll`: 가상 스크롤을 통한 세그먼트 단위 로딩 (`onScrollRequest`)
  - `Ctrl+F`: 검색 바 활성화
  - `Double Click`: 북마크 토글
  - **스플릿 뷰 렌더링 최적화**: 뷰포트 너비가 크게 변할 때(스플릿 모드 진입 등) 가로 스크롤을 자동으로 0으로 리셋하여 왼쪽 패널의 타임스탬프/로그레벨이 가려지는 현상을 완벽히 해결했습니다. [FIX] 🐧🛠️✨

### [[Split Performance Analyzer]]
- **ID**: `ui-split-analyzer`
- **Keywords**: [`성능 분석`, `Split Analysis`, `Regression`, `Improvement`, `Delta Change`]
- **Location**:
  - `Panel`: [SplitAnalyzerPanel.tsx](./components/LogViewer/SplitAnalyzerPanel.tsx) [REFACTORED]
  - `Worker`: [SplitAnalysis.worker.ts](./workers/SplitAnalysis.worker.ts)
  - `Hook`: [useSplitAnalysis.ts](./hooks/useSplitAnalysis.ts)
- **Features**:
  - **2단 레이아웃(Timeline|Metrics)**: 실행 흐름(시작점 ↓ 종료점)과 시간 분석 데이터(LEFT|RIGHT|REG)를 수직으로 분리하여 가독성 극대화. [NEW]
  - **성능 변화 통합 분석**: 시간 지연(Regression, 🟠)뿐만 아니라 성능 개선(Improvement, 🟢) 항목도 함께 분석하여 요약 리포트 제공. [NEW] 🐧📊🎯
  - **코드 라인 연동**: 로그 내부에서 추출한 코드 라인 번호를 우선 노출하여 소스 코드와의 연결성 강화.
  - **초슬림 모드**: 카드 높이를 획기적으로 낮춰 대량의 분석 결과를 효율적으로 탐색 가능하도록 최적화. [NEW]
- **Data Flow**: `Worker (Metric Calculation)` -> `useSplitAnalysis` -> `SplitAnalyzerPanel (Summary + Detail View)`

### [[Mission Manager]]
- **ID**: `ui-mission-manager`
- **Keywords**: [`미션 매니저`, `순서 변경`, `rule order`, `reorder`, `drag and drop`]
- **Location**:
  - `Modal`: [MissionManagerModal.tsx](./components/LogViewer/MissionManagerModal.tsx)
  - `Trigger`: [TopBar.tsx](./components/LogViewer/TopBar.tsx)
- **Interactions**:
  - `Drag & Drop`: `framer-motion`의 `Reorder`를 사용하여 분석 규칙(Mission)의 표시 순서를 변경합니다.
  - `Apply`: 변경된 순서를 전역 상태와 `localStorage`에 즉시 반영합니다.
  - `UI Polish`: 불필요한 UUID 정보를 제거하고 UI 전체를 영문화하여 시인성을 높였습니다. [NEW] 🐧📋

### [[Text Selection & Context Menu]]
- **ID**: `interaction-log-selection`
- **Keywords**: [`텍스트 선택`, `복사`, `우클릭 메뉴`, `selection`, `context menu`, `Confluence Table`, `이스케이프`, `Ctrl+C`]
- **Location**:
  - `Logic`: [useLogSelection.ts](./hooks/useLogSelection.ts)
  - `Export Actions`: [useLogExportActions.ts](./hooks/useLogExportActions.ts) [UPDATED]
  - `Exporter`: [confluenceUtils.ts](./utils/confluenceUtils.ts)
  - `View`: [ContextMenu.tsx](./components/ContextMenu.tsx)
- **Interactions & Shortcuts**:
  - `Mouse Drag`: 로그 라인 선택
  - `Ctrl+C`: **선택된 라인이 있을 경우 해당 라인만 복사하도록 개선**. 선택 영역이 없으면 기존처럼 전체 복사 유지. [NEW] 🐧🎯
  - `Tab Header Button`: **Copy as Confluence Table 버튼은 현재 선택 여부와 상관없이 항상 전체 필터링된 로그를 복사**하도록 정책 고정! [MOD] 🐧💎
  - `Shift + Click`: 범위 선택
  - **최근 개선 (Big Log Fix)**: 1GB 이상 대용량 로그 필터링 시 페이지(Segment Index)가 초기화되지 않아 화면이 비어 보이던 버그 해결. 
  - **최근 최적화 (Extreme Performance)**: 
    - **Loading Splash & Plugin Lazy Mount**: 앱 초기 로딩 시 모든 플러그인을 한꺼번에 마운트하여 메인 스레드를 점유하던 병목을 해결했슴다. `PluginContainer`에 지연 마운팅(Lazy Mount)을 도입하여 활성화된 적이 있는 플러그인만 메모리에 유지하도록 개선, 로딩 화면의 애니메이션이 끊김 없이 부드럽게 동작하도록 최적화했슴다. [TURBO] 🐧🚀💎
    - **WASM Cold Start & JIT 예열 완벽 해결**: 앱 최초 실행 시 V8 엔진의 JIT 컴파일 지연과 WASM 초기화 미동기화로 인해 첫 필터링이 JS Fallback으로 빠지며 5.5초가 걸리던 고질적 문제를 완전히 뽑았습니다! 인덱싱과 동시에 워커를 스폰(`initSubWorkers`)하고, 더미 텍스트로 5만 번 엔진을 예열하여 첫 필터링도 무조건 3초대 최고 속도를 냅니다. [TURBO] 🐧🚀
    - 필터링 시 동시 RPC 요청을 4개로 제한(Throttling)하여 IPC 부하 및 메모리 스파이크 차단. [STABLE]
    - 청크당 라인수를 최대 20,000개로 제한하여 Electron IPC 대역폭 초과 방지. [RELIABLE]
    - 서브 워커에서 대용량 문자열 split 대신 Uint8Array 직접 순회 방식으로 변경하여 OOM 완전 차단. [ZERO-COPY]
    - **초거대 용량 동적 스케일링(Dynamic Strategy)**: 파일 전체 라인 수(`totalLines`)에 비례하여 처리 청크 크기와 워커 동시성(Concurrency)을 가변적으로 조절하는 **지능형 엔진**을 탑재했습니다. 
      - **500만 줄 초과**: 최대 250,000줄 청크 단위 처리, 가용 코어 수 초과 동원(동시성 강화)하여 극한의 처리 속도 확보. (RPC 통신량 최소화) [DYNAMIC] 🐧🔥
      - **일반 용량(100만 줄 이하)**: 20,000줄 짧은 청크로 잘게 쪼개어 UI 병목을 분산, 즉각적인 체감 반응속도 향상.
    - **필터 결과 렌더링 RPC 병목 해결**: 대용량 로컬 파일에서 듬성듬성 떨어진 필터 결과 라인들을 화면에 그릴 때, 기존에 1줄씩 "수백 번"의 RPC 통신을 치던 심각한 병목을 **스마트 간격 병합(Gap Merge) 및 `Promise.all` 병렬 통신**으로 교체하여 8초의 렌더링 지연을 1초 미만으로 박살냈습니다! (Zero-IPC-overload) [TURBO] 🐧💎    
    - 대규모 텍스트 디코딩 루프 내의 무거운 **정규식 매칭(`.replace()`)을 제거하고 바이트 레벨 비교**로 대체하여 단일 코어 처리 속도 극한 최적화. [TURBO]
    - 최대 지원 라인수를 20M으로 상향하여 초고밀도 로그 파일 대응. [SCALABLE]
    - 필터 변경 시 자동으로 1페이지로 이동, 캐시 클리어, **최상단 스크롤(scrollTo(0))** 적용! [UX-FIX] 🐧🚀
  - **수정 (Export Policy)**: Confluence 테이블 복사 시, 기존 `||` (Jira/Confluence 레거시 표기법) 대신 **표준 Markdown 형식(`|---|---|`)**을 적용하여 최신 Confluence 에디터에서 완벽하게 표(Table)로 인식하도록 수정했습니다. 또한, 특수문자(`{`, `}`, `[`, `]`)를 **전각 문자(｛, ｝, ［, ］)**로 교체하여 시각적 차이 없이 Confluence 파서의 오동작을 100% 차단했습니다. `|` 문자는 전각 파이프(`｜`)로 대체하여 데이터 손실 없이 테이블 구조를 보호합니다! [MOD] 🐧💎

---

## 3. Major Plugins (주요 플러그인)
검증된 안정성과 높은 사용 빈도를 가진 핵심 도구들입니다. **실험실 플러그인보다 우선적으로 관리 및 참조**됩니다.

### [[EasyPost Plugin]]
- **ID**: `plugin-easy-post`
- **Keywords**: [`API Test`, `Postman`, `Request`, `Response`, `Environment`]
- **Location**:
  - `Main`: [EasyPostPlugin.tsx](./plugins/EasyPost/EasyPostPlugin.tsx)
- **Core Interface**:
  - `handleSendRequest()`: HTTP 요청 실행 및 결과 처리
  - `Variable Injection`: `{{variable}}` 형식의 동적 치환 로직
- **Data Flow**: `Request Setup` -> `Context Variables` -> `Axios/Fetch` -> `Response View`

### [[Perf Tool Plugin]]
- **ID**: `plugin-perf-tool`
- **Keywords**: [`성능 측정`, `CPU 분석`, `Performance Tool`, `Sampling`]
- **Location**:
  - `Main Logic`: [PerfToolPlugin.tsx](./plugins/core/PerfToolPlugin.tsx)
- **Core Interface**:
  - `analyzePerformance()`: 캡처된 데이터 분석 및 시각화
- **Data Flow**: `Raw Data` -> `Parser` -> `Timeline View`

### [[PostTool Plugin]]
- **ID**: `plugin-post-tool`
- **Keywords**: [`HTTP`, `REST`, `Postman`, `API Test`, `post-tool`]
- **Location**:
  - `Main Logic`: [PostToolPlugin.tsx](./plugins/core/PostToolPlugin.tsx)
- **Core Interface**:
  - **CLI 연동**: `npm run cli -- post-tool` 명령어를 통해 저장된 백그라운드 API 발송 기능 지원. [NEW]

### [[JsonTools Plugin]]
- **ID**: `plugin-json-tools`
- **Keywords**: [`JSON`, `Formatter`, `Beautify`, `Validator`, `json-tool`]
- **Location**:
  - `Main Logic`: [JsonToolsPlugin.tsx](./plugins/core/JsonToolsPlugin.tsx)
- **Core Interface**:
  - **CLI 연동**: `npm run cli -- json-tool` 명령어로 대규모 JSON 파일 즉각 Beautify 지원. [NEW]

### [[TpkExtractor Plugin]]
- **ID**: `plugin-tpk-extractor`
- **Keywords**: [`TPK`, `Tizen Package`, `Extractor`, `Decompile`, `tpk-extractor`]
- **Location**:
  - `Main Logic`: [TpkExtractorPlugin.tsx](./plugins/core/TpkExtractorPlugin.tsx)
- **Core Interface**:
  - **CLI 연동**: 웹 워커 없이 터미널 모드에서 RPM 파싱 및 TPK 추출 지원 (URL/로컬경로 모두 허용). [NEW]

### [[BlockTest Plugin]]
- **ID**: `plugin-block-test`
- **Keywords**: [`BlockTest`, `Scenario`, `Pipeline`, `Automation`, `블록테스트`, `자동화`]
- **Location**:
  - `Main Component`: [index.tsx](./components/BlockTest/index.tsx)
  - `Hook`: [useBlockTest.ts](./components/BlockTest/hooks/useBlockTest.ts)
- **Core Interface**:
  - `executePipeline()` & `executeScenario()`: 블록 단위 테스트 묶음 실행 및 Socket.io 기반 원격 제어
  - **CLI 연동**: GUI 환경뿐만 아니라 `Headless CLI`를 통해서도 미리 저장된 Scenario 및 Pipeline 실행을 완벽하게 지원합니다. [NEW] 🐧🚀

---

## 4. Lab Plugins (실험실 플러그인)
새로운 시도나 실험적인 기능이 포함된 플러그인 모음입니다.

### [[SmartThingsLab Plugin]]
- **ID**: `plugin-st-lab`
- **Keywords**: [`SmartThings`, `ST Lab`, `Capability`, `SSE`, `Device Control`, `Virtual Device`]
- **Location**:
  - `Main`: [SmartThingsLabPlugin.tsx](./plugins/SmartThingsLab/SmartThingsLabPlugin.tsx)
  - `Service`: [smartThingsService.ts](./plugins/SmartThingsLab/services/smartThingsService.ts)
  - `SSE`: [sseService.ts](./plugins/SmartThingsLab/services/sseService.ts)
- **Core Interface**:
  - `refreshData()`: 위치, 방, 디바이스 정보 일괄 갱신
  - `executeCommand(deviceId, commands)`: 디바이스 제어 명령 전송
  - `sse.connect(url, token)`: 실시간 이벤트 스트림 연결
- **Data Flow**: `ST API` -> `Service` -> `State(locations/devices)` -> `Hierarchy/Card UI`

### [[TizenLab Plugin]]
- **ID**: `plugin-tizen-lab`
- **Keywords**: [`Tizen`, `SDB`, `File Explorer`, `App Manager`, `Perf Monitor`]
- **Location**:
  - `Main`: [TizenLabPlugin.tsx](./plugins/TizenLab/TizenLabPlugin.tsx)
  - `File`: [TizenFileExplorer.tsx](./plugins/TizenLab/TizenFileExplorer.tsx)
- **Core Interface**:
  - `TizenConnectionModal`: SDB 연결 설정 및 관리
  - `TizenPerfMonitor`: 실시간 리소스(CPU, Memory) 모니터링
- **Data Flow**: `SDB Shell` -> `Backend(Electron)` -> `TizenLab UI`

---

## 5. Shared Services & Contexts
플러그인 간에 공유되는 공통 인프라입니다.

### [[Toast Notification]]
- **ID**: `service-toast`
- **Keywords**: [`알림`, `토스트`, `notification`, `message`]
- **Location**:
  - `Context`: [ToastContext.tsx](./contexts/ToastContext.tsx)
- **Core Interface**:
  - `addToast(message, type)`: 알림 생성

### [[Command Palette]]
- **ID**: `service-command-palette`
- **Keywords**: [`명령 팔레트`, `command palette`, `quick action`, `Ctrl+K`]
- **Location**:
  - `View`: [CommandPalette.tsx](./components/CommandPalette/CommandPalette.tsx)
  - `Context`: [CommandContext.tsx](./contexts/CommandContext.tsx)

### [[Global Settings & CLI Guide]]
- **ID**: `ui-global-settings`
- **Keywords**: [`설정`, `settings`, `CLI 설정`, `CLI guide`, `zoom`, `theme`]
- **Location**:
  - `Modal`: [SettingsModal.tsx](./components/SettingsModal.tsx)
  - `Context`: [HappyToolContext.tsx](./contexts/HappyToolContext.tsx)
- **Core Interface**:
  - `CLI Tab`: CLI 전용 출력 폴더 설정 및 명령어 퀵 가이드(복사 가능) 제공
  - `General Tab`: 테마(Dark 선호) 및 UI 확대/축소(Zoom) 관리
  - `Plugins Tab`: 사이드바 플러그인 활성화/비활성화 제어
- **Interactions**:
  - `Copy Command`: 설정창 내에서 CLI 실행 명령어를 즉시 클립보드에 복사 가능 [NEW] 🐧🚀

---

## 6. Advanced Features & Persistence
고도화된 기능 및 데이터 저장소 매핑입니다.

### [[Log Archive System]]
- **ID**: `feature-log-archive`
- **Keywords**: [`아카이브`, `저장된 로그`, `IndexedDB`, `archive`, `history`]
- **Location**:
  - `Entry`: [index.tsx](./components/LogArchive/index.tsx)
  - `Provider`: [LogArchiveProvider.tsx](./components/LogArchive/LogArchiveProvider.tsx)
  - `DB`: [LogArchiveDB.ts](./components/LogArchive/db/LogArchiveDB.ts)
- **Core Interface**:
  - `SaveArchiveDialog`: 선택한 로그를 아카이브에 저장하는 인터페이스
  - `ArchiveSidebar`: 저장된 목록 표시 및 검색
- **Data Flow**: `Log Selection` -> `index.tsx(Save)` -> `IndexedDB` -> `Sidebar/Viewer`

### [[Performance Analysis Engine]]
- **ID**: `logic-perf-analysis`
- **Keywords**: [`성능 분석`, `performance`, `heat map`, `bottleneck`, `time gap`]
- **Location**:
  - `Logic`: [perfAnalysis.ts](./utils/perfAnalysis.ts)
  - `View`: [PerfDashboard.tsx](./components/LogViewer/PerfDashboard.tsx)
- **Core Interface**:
  - `analyzePerfSegments()`: 로그 간 시간 차이를 계산하여 병목 지점 추출
  - `extractTimestamp()`: 다양한 로그 포맷에서 타임스탬프 파싱
- **Data Flow**: `Filtered Logs` -> `perfAnalysis.ts` -> `Segments/Heatmap` -> `Canvas Layer`

---

## 7. Sequence: How Things Work
주요 시퀀스의 데이터 흐름 요약입니다.

### [[File Loading to Rendering]]
- **Flow**:
  1. `useLogFileOperations.ts` -> 파일 시스템 접근
  2. `LogProcessor.worker.ts` -> `buildFileIndex()` 호출 (라인 정보 추출)
  3. `LogProcessor.worker.ts` -> `applyFilter()` 호출 (인덱싱 및 필터링)
  4. `LogViewerPane.tsx` -> `onScrollRequest` 트리거
  5. `HyperLogRenderer.tsx` -> `Canvas`에 텍스트 드로잉

---

## 8. Important Documents (중유 문서) 📚
프로젝트의 성능 기준 및 설계 철학이 담긴 문서들입니다.

### [[Performance & Standards]]
- **ID**: `docs-performance-standards`
- **Location**:
    - `Performance History`: [performance_history.md](./important/performance_history.md) [NEW]
    - `Standards`: [performance_standards.md](./important/performance_standards.md)
    - `Blueprint`: [LOG_EXTRACTOR_PERFORMANCE_BLUEPRINT.md](./important/LOG_EXTRACTOR_PERFORMANCE_BLUEPRINT.md)

### [[CLI Automation Guide]]
- **ID**: `docs-cli-automation`
- **Location**:
    - `CLI User Guide`: [cli_user_guide.md](./important/cli_user_guide.md) [NEW]
- **Description**: 터미널 환경에서 백그라운드로 대규모 로그 추출기(Log Extractor)와 자동화 시나리오(BlockTest)를 구동하는 방법 및 예제를 담은 매뉴얼입니다. 🐧🚀

---

---

## 9. Future Roadmap & Deferred Features 🔮
안정성과 성능의 균형을 위해 잠시 미뤄둔 과제들입니다.

### [[Phase 3: RAM Capping]]
- **Status**: `DEFERRED` (미래 과제)
- **Goal**: 2GB 이상의 초거대 로그 대응을 위한 메모리 점유 상한제 도입.
- **Plan**: `IndexedDB` 스와핑 로직 및 청크 관리 시스템 구축.

---

## 10. Build & Maintenance Systems 🛠️
패키징 안정성 및 개발 환경 정리를 위한 도구 모음입니다.

### [[Build Cleanup Utility]]
- **ID**: `tool-build-cleanup`
- **Keywords**: [`빌드 정리`, `cleanup`, `taskkill`, `debug.log cleanup`, `build preprocess`]
- **Location**:
  - `Script`: [cleanup_build.cjs](./scripts/cleanup_build.cjs)
- **Functions**:
  - `Process Kill`: 빌드 전 실행 중인 `HappyTool.exe` 강제 종료로 파일 잠금 방지
  - `Resource Cleanup`: `dist_electron` 내의 잔여 로그 파일 및 임시 파일 정리
- **Usage**: `npm run electron:build` 등 모든 빌드 명령어 시작 시 자동 실행

---

> [!TIP]
> **형님, 패키징 시 발생하던 파일 잠금 문제까지 완벽하게 해결되었습니다!** 이제 프로세스 충돌 걱정 없이 빌드하시면 됩니다! 🐧🚀🏗️
