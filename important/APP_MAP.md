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
  - **빌드 시스템**: Vite 6 (Worker format: IIFE로 번들링하여 생산 빌드 호환성 확보)
  - **데스크톱 프레임워크**: Electron 39 (Sandbox: false, SharedArrayBuffer 활성화)
- **Location**:
- [ ] Location:
  - `Html`: [index.html](./index.html) (Vite Entry Point)
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

---

## 2. Core Feature: Log Extractor
대용량 로그 분석의 핵심 엔진과 UI입니다.

### [[Log Extractor Engine]]
- **ID**: `logic-log-extractor-core`
- **Keywords**: [`필터링`, `인덱싱`, `filtering`, `indexing`, `applyFilter`, `file load`]
- **Location**:
  - `Main Logic`: [useLogExtractorLogic.ts](./hooks/useLogExtractorLogic.ts)
  - `Worker`: [LogProcessor.worker.ts](./workers/LogProcessor.worker.ts)
  - `WASM Engine`: [src-wasm/](./src-wasm/)
- **Core Interface**:
  - `applyFilter(rule, quickFilter)`: 필터링 요청 트리거
  - `buildFileIndex(file)`: 파일 초기 인덱싱 스캔
  - `filteredIndices`: 필터링된 결과 라인 번호 배열 (Int32Array)
- **Data Flow**: `File/Stream` -> `Worker(Indexing)` -> `WASM/SubWorker(Filtering)` -> `filteredIndices` -> `UI Rendering`
- **Sub-Modules (Worker Engine)**:
  - `Main Processor`: [LogProcessor.worker.ts](./workers/LogProcessor.worker.ts) (중앙 제어)
  - `Stream Reader`: [LogStream.worker.ts](./workers/LogStream.worker.ts) + [workerDataReader.ts](./workers/workerDataReader.ts)
  - `Filter Sub`: [LogFilterSub.worker.ts](./workers/LogFilterSub.worker.ts) (병렬 필터링)
  - `Search Engine`: [Search.worker.ts](./workers/Search.worker.ts) (고속 텍스트 검색)
  - `Perf Engine`: [PerfTool.worker.ts](./workers/PerfTool.worker.ts) (성능 샘플 가공)
- **Sub-Modules**:
  - `Worker Events`: [useLogWorkerEvents.ts](./hooks/useLogWorkerEvents.ts) (워커 메시지 디스패처)
  - `Bookmark Handler`: [workerBookmarkHandlers.ts](./workers/workerBookmarkHandlers.ts)
  - `Analysis Handler`: [workerAnalysisHandlers.ts](./workers/workerAnalysisHandlers.ts)
- **Resource Optimizations**:
  - `Lazy SAB Allocation`: 로컬 파일 모드 시 불필요한 260MB SharedArrayBuffer 할당 지연 (RAM 절약)
  - `Active State Sync`: `SET_ACTIVE_STATE` 이벤트를 통한 백그라운드 탭의 유령 워커(`subWorkers`) 자동 정리
  - `Auto-Filter Suppression`: 비활성 탭에서의 중복 필터링 연산 차단 (CPU 절약)

### [[Log Viewer Components (The Alleys)]]
- **ID**: `ui-log-viewer-sub`
- **Keywords**: [`북마크 모달`, `단축키`, `줄 이동`, `BookmarksModal`, `GoToLine`, `Shortcuts`]
- **Location**:
  - `Modal`: [BookmarksModal.tsx](./components/BookmarksModal.tsx), [GoToLineModal.tsx](./components/GoToLineModal.tsx)
  - `Panel`: [KeyboardShortcutsPanel.tsx](./components/KeyboardShortcutsPanel.tsx)
- **Interactions**:
  - `Ctrl + G`: 줄 이동 모달 활성화
  - `Ctrl + /`: 단축키 도움말 패널 토글
  - `Bookmark Loop`: `BookmarksModal` -> `onJump` -> `HyperLogRenderer` (스크롤 이동)

### [[Log Viewer UI Architecture]]
- **ID**: `ui-log-viewer-hierarchy`
- **Keywords**: [`로그 뷰어`, `렌더러`, `virtual scroll`, `pane`, `HyperLogRenderer`]
- **Location**:
  - `Container`: [LogSession.tsx](./components/LogSession.tsx)
  - `Pane`: [LogViewerPane.tsx](./components/LogViewer/LogViewerPane.tsx)
  - `Renderer`: [HyperLogRenderer.tsx](./components/LogViewer/HyperLogRenderer.tsx)
- **Interactions**:
  - `Scroll`: 가상 스크롤을 통한 세그먼트 단위 로딩 (`onScrollRequest`)
  - `Ctrl+F`: 검색 바 활성화
  - `Double Click`: 북마크 토글

### [[Text Selection & Context Menu]]
- **ID**: `interaction-log-selection`
- **Keywords**: [`텍스트 선택`, `복사`, `우클릭 메뉴`, `selection`, `context menu`]
- **Location**:
  - `Logic`: [useLogSelection.ts](./hooks/useLogSelection.ts)
  - `View`: [ContextMenu.tsx](./components/ContextMenu.tsx)
  - `Export Actions`: [useLogExportActions.ts](./hooks/useLogExportActions.ts)
  - `Utils`: [confluenceUtils.ts](./utils/confluenceUtils.ts)
- **Interactions & Shortcuts**:
  - `Mouse Drag`: 로그 라인 선택
  - `Right Click`: 컨텍스트 메뉴 표시 (복사, 구글 검색, 아카이브 저장 등)
  - `Shift + Click`: 범위 선택
  - `Copy as Confluence`: 선택 영역 또는 북마크를 Confluence 테이블 형식으로 변환 및 복사

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
- **Keywords**: [`성능 측정`, `CPU 분석`, `Performance Tool`, `Sampling`, `flame map`, `플레임 맵`]
- **Location**:
  - `Main Logic`: [PerfToolPlugin.tsx](./plugins/core/PerfToolPlugin.tsx)
- **Core Interface**:
  - `analyzePerformance()`: 캡처된 데이터 분석 및 시각화
- **Data Flow**: `Raw Data` -> `Parser` -> `Timeline View`

### [[PostTool Plugin]]
- **ID**: `plugin-post-tool`
- **Keywords**: [`HTTP`, `REST`, `Postman`, `API Test`]
- **Location**:
  - `Main Logic`: [PostToolPlugin.tsx](./plugins/core/PostToolPlugin.tsx)

### [[JsonTools Plugin]]
- **ID**: `plugin-json-tools`
- **Keywords**: [`JSON`, `Formatter`, `Beautify`, `Validator`]
- **Location**:
  - `Main Logic`: [JsonToolsPlugin.tsx](./plugins/core/JsonToolsPlugin.tsx)

### [[TpkExtractor Plugin]]
- **ID**: `plugin-tpk-extractor`
- **Keywords**: [`TPK`, `Tizen Package`, `Extractor`, `Decompile`]
- **Location**:
  - `Main Logic`: [TpkExtractorPlugin.tsx](./plugins/core/TpkExtractorPlugin.tsx)

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

### [[Other Lab Tools]]
- **ID**: `plugin-lab-others`
- **Keywords**: [`TPK`, `JSON`, `Postman`, `Extractor`]
- **Location**:
  - `TPK`: [TpkExtractor.tsx](./components/TpkExtractor.tsx) + [useTpkExtractorLogic.ts](./hooks/useTpkExtractorLogic.ts)
  - `JSON`: [JsonTools.tsx](./components/JsonTools.tsx)
  - `Post`: [PostTool.tsx](./components/PostTool.tsx)

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
  - `Context`: [CommandContext.tsx](./contexts/CommandContext.tsx)

### [[Global State & Settings]]
- **ID**: `service-global-state`
- **Keywords**: [`설정`, `전역 상태`, `settings`, `localStorage`]
- **Location**:
  - `View`: [SettingsModal.tsx](./components/SettingsModal.tsx)
  - `Context`: [HappyToolContext.tsx](./contexts/HappyToolContext.tsx)
  - `Helper`: [settingsHelper.ts](./utils/settingsHelper.ts)
- **Core Interface**:
  - `useSettings()`: 테마, 폰트, 로그 자동 로드 등 사용자 환경 설정 관리

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
- **Keywords**: [`성능 분석`, `performance`, `heat map`, `bottleneck`, `time gap`, `flame map`, `플레임 맵`]
- **Location**:
  - `Logic`: [perfAnalysis.ts](./utils/perfAnalysis.ts)
  - `View`: [PerfDashboard.tsx](./components/LogViewer/PerfDashboard.tsx)
- **Core Interface**:
  - `analyzePerfSegments()`: 로그 간 시간 차이를 계산하여 병목 지점 추출
  - `extractTimestamp()`: 다양한 로그 포맷에서 타임스탬프 파싱
- **Data Flow**: `Filtered Logs` -> `perfAnalysis.ts` -> `Segments/Heatmap` -> `Canvas Layer`

### [[Utility Belt (Infrastructure)]]
- **ID**: `infra-utils`
- **Keywords**: [`시간 분석`, `색상`, `정규식`, `logTime`, `colorUtils`, `filterGroupUtils`, `build config`, `electron main`]
- **Location**:
  - `Time`: [logTime.ts](./utils/logTime.ts)
  - `Color`: [colorUtils.ts](./utils/colorUtils.ts)
  - `Filter Logic`: [filterGroupUtils.ts](./utils/filterGroupUtils.ts) (Happy Combo 트리 연산)
  - `Build Config`: [vite.config.ts](./vite.config.ts) (Worker IIFE 및 플러그인 설정)
  - `Main Process`: [electron/main.js](./electron/main.js) (보안 정책 및 SharedArrayBuffer 설정)
- **Core Interface**:
  - `extractTimestamp(text)`: 로그 라인에서 시간 정보 추출 (성능 분석의 기초)
  - `getLighterColor(color)`: UI 테마에 맞는 색상 변환

---

## 7. Log Extractor Deep Dive (Advanced Specs)

### [Feature] Log Analysis & Profiling
- **ID**: `feature-log-analysis`
- **Keywords**: [`Spam`, `Repetitive`, `Transaction`, `Bottleneck`, `Delta`, `PID/TID Tracking`, `스팸 분석기`, `스팸 분식기`, `중복 로그`, `트랜잭션 추적`]
- **Location**:
    - View: [SpamAnalyzerPanel.tsx](./components/LogViewer/SpamAnalyzerPanel.tsx), [TransactionDrawer.tsx](./components/LogViewer/TransactionDrawer.tsx)
    - Logic: [transactionAnalysis.ts](./utils/transactionAnalysis.ts), [logTime.ts](./utils/logTime.ts)
- **Core Interface**:
    - `extractTransactionIds(line)`: 복잡한 정규식을 사용하여 PID, TID, Tag 추출
    - `formatTransactionFlow(logs)`: 순차 로그 간 `delta` 시간(+ms) 계산
    - `requestSpamAnalysisLeft()`: 워커 측 패턴 그룹화 트리거 (Top 100)
- **Interactions**:
    - `Jump to Absolute Line`: 필터 변경 후에도 일관성을 유지하기 위해 Spam Analyzer에서 사용
    - `Bottleneck Highlight`: Transaction Drawer에서 1000ms 이상의 지연을 자동으로 플래그 지정

### [Feature] High-Performance Rendering (HyperLog)
- **ID**: `feature-hyper-rendering`
- **Keywords**: [`Canvas`, `Virtual Scroll`, `60fps`, `Ligatures`, `Measure Cache`]
- **Location**:
    - Core: [HyperLogRenderer.tsx](./components/LogViewer/HyperLogRenderer.tsx)
- **Core Interface**:
    - `loadVisibleLines(start, end)`: 5000줄 단위의 배치 데이터 페칭
    - `decodeHTMLEntities(text)`: 캔버스에서의 정확한 폰트 너비 측정을 위한 필수 전처리
    - `performanceHeatmap`: 로그 밀도 및 성능 핫존을 보여주는 우측 세로 스트립
- **Optimizations**:
    - `indexOf` vs `Regex`: 단순 키워드 하이라이트를 위한 고속 문자열 검색 사용
    - `Dual Canvas`: 배경 하이라이트와 텍스트 렌더링을 분리하여 무효화 최소화

### [Feature] Configuration & Persistence
- **ID**: `feature-config-mgmt`
- **Keywords**: [`Happy Combo`, `Sync`, `Paging`, `Stream`, `IndexedDB`, `Persistence`]
- **Location**:
    - View: [ConfigurationPanel.tsx](./components/LogViewer/ConfigurationPanel.tsx), [HappyComboSection.tsx](./components/LogViewer/ConfigSections/HappyComboSection.tsx)
    - Logic: [useLogFileOperations.ts](./hooks/useLogFileOperations.ts), [db.ts](./utils/db.ts)
- **Core Interface**:
    - `state_persistence`: 1초마다 `tabState_${tabId}` (경로, 스크롤, 선택) 저장
    - `streamReadFile(path, requestId)`: 대용량 파일 세그먼트 전송을 위한 Electron IPC
- **Data Flow**:
    - `File Open` -> `INIT_STREAM` -> `PROCESS_CHUNK` (Worker) -> `STREAM_DONE` -> `Indexing`
    - `Rule Update` -> `applyFilter` (Worker) -> `LRU Cache Check` -> `Render`

---

## 8. Sequence: How Things Work
주요 시퀀스의 데이터 흐름 요약입니다.

### [[File Loading to Rendering]]
- **Flow**:
  1. `useLogFileOperations.ts` -> `streamReadFile` 호출
  2. `LogProcessor.worker.ts` -> `PROCESS_CHUNK` 수신 및 인덱싱
  3. `LogProcessor.worker.ts` -> `applyFilter()` 호출 (인덱싱 및 필터링)
  4. `LogViewerPane.tsx` -> `HyperLogRenderer`에 `totalCount` 전달
  5. `HyperLogRenderer.tsx` -> `onScrollRequest` 트리거 -> `Canvas` 렌더링

---

> [!TIP]
> **모든 지도가 그려졌습니다!** 형님, 이제 "어느 파일의 어느 함수"를 찾을 때 이 지도를 먼저 보여주시면 제가 0.1초 만에 튀어나가겠습니다! 🐧🚀
