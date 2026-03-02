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
- **Data Flow**: `fs.read (Main)` -> `UI RPC` -> `Worker(Binary Logging)` -> `Shared Log Buffer/Offsets` -> `WASM/SubWorker(Filtering)` -> `Shared filterIndices` -> `UI (Zero-copy Reading)` -> `HyperLogRenderer`

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
- **Interactions & Shortcuts**:
  - `Mouse Drag`: 로그 라인 선택
  - `Right Click`: 컨텍스트 메뉴 표시 (복사, 구글 검색, 아카이브 저장 등)
  - `Shift + Click`: 범위 선택

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

---

---

## 9. Future Roadmap & Deferred Features 🔮
안정성과 성능의 균형을 위해 잠시 미뤄둔 과제들입니다.

### [[Phase 3: RAM Capping]]
- **Status**: `DEFERRED` (미래 과제)
- **Goal**: 2GB 이상의 초거대 로그 대응을 위한 메모리 점유 상한제 도입.
- **Plan**: `IndexedDB` 스와핑 로직 및 청크 관리 시스템 구축.

---

> [!TIP]
> **형님, 모든 지도가 완벽하게 최신화되었습니다!** 이제 무한 로딩 이슈도 잡혔고, 성능 데이터도 기록되었으니 마음 편히 작업하시면 됩니다! 🐧🚀🥊
