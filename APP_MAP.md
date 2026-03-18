# HappyTool APP_MAP (AI 작업 지도)

형님! 이 지도는 AI Agent가 프로젝트의 기능을 즉시 찾고 분석할 수 있도록 돕는 **인터페이스 규격 기반의 지도**입니다.
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
- **Keywords**: [`CLI`, `Headless`, `Automated Test`, `Background Execution`, `commander`, `hidden window`, `fallback`]
- **Location**:
  - `Main Entry`: [cli.cjs](./electron/cli.cjs)
  - `Main Process`: [main.cjs](./electron/main.cjs)
  - `Renderer UI`: [CliApp.tsx](./CliApp.tsx)
  - `Renderer Logic Hook`: [useCliHandlers.ts](./hooks/useCliHandlers.ts) [NEW]
- **Core Interface**:
  - `runCli(args)`: 커맨드라인 매개변수 파싱 및 Headless(Hidden) BrowserWindow 생성
  - **연결 안정화**: Vite 서버 대기 시 5초 타임아웃 및 `app://` 프로토콜(빌드 파일) 자동 Fallback 로직 탑재 [NEW]
  - `CliApp`: CLI 렌더러 진입점. 500줄 초과 방지를 위해 핵심 커맨드 핸들러를 별도 훅으로 위임.
  - `useCliHandlers`: `analyze-diff`, `log-extractor` 등 실제 커맨드 처리 오케스트레이션 훅 [NEW]
- **Data Flow**: `Terminal` -> `cli.cjs` -> `Connection Sync (Timeout/Fallback)` -> `IPC (cli-run-command)` -> `CliApp/useCliHandlers` -> `Terminal`


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
- **데이터 흐름**: Log Worker(Main) ↔ Log Worker(Sub/WASM) ↔ UI (SharedArrayBuffer Zero-copy Binary Read)
- **최근 최적화**:
  - `LogProcessor.worker.ts` 내 메시지 전달 루프를 `async/await` 구조로 개편하여 레이스 컨디션 해결 및 안정성 확보.
  - **SharedArrayBuffer 기반 Zero-copy Binary Read** 구현. 워커에 데이터를 요청하는 대신 UI(HyperLogRenderer)에서 직접 공유 메모리를 읽어 렌더링 속도 비약적 향상 및 RAM 다이어트 성공!
  - **RPC 기반 대용량 파일 스트리밍(`isLocalFileMode`)** 구현. File API를 탈피하고, 700MB, 2GB 등 초거대 로그 파일을 로드할 때 발생하는 메모리 초과(OOM)를 원천 차단했습니다! RPC로 필요한 청크만 요청하여 메인 및 하위 워커에 병렬로 배분하는 궁극의 제로카피 구조 완성. [NEW]
- **Core Messages**:
  - `INIT_LOCAL_FILE_STREAM`: `{ path, size }` -> 로컬 디스크에서 직접 청크 단위로 스트리밍 인덱스 빌드 및 필터링 수행 [NEW]
  - `RPC_REQUEST` / `RPC_RESPONSE`: 워커 ↔ UI ↔ 메인 간 파일 직접 읽기(`readFileSegment`) 통신 채널 [NEW]
  - `GET_LINES`: `{ startLine, count }` -> 필터링된 결과에서 지정된 오프셋의 로그 반환 (SAB 및 RPC 지원)
  - `BUFFER_SHARED`: `{ logBuffer, lineOffsets, ... }` -> UI에 공유 메모리 주소 전달 (Zero-copy 시작 알림)
  - `FILTER_LOGS`: `{ happyGroups, excludes, quickFilter, ... }` -> 필터 룰 적용
  - **성능 분석 고도화**: 로그 내부의 함수 호출 라인 번호(예: `OnResume(350)`)를 정규식으로 정밀 추출(`codeLineNum`)하여 분석 리포트의 정확도를 비약적으로 향상시켰습니다. [NEW]
- **Data Flow**: `fs.read (Main)` -> `UI RPC` -> `Worker(Binary Logging)` -> `Shared Log Buffer/Offsets` -> `WASM/SubWorker(Filtering)` -> `Shared filterIndices` -> `UI (Zero-copy Reading)` -> `HyperLogRenderer`

### [[Headless CLI Engine]]
- **ID**: `logic-headless-cli-core`
- **Keywords**: [`CLI`, `커맨드라인`, `headless`, `background`, `commander`, `CliApp`, `useCliHandlers`, `timeout`]
- **Location**:
  - `Main CLI Entry`: [cli.cjs](./electron/cli.cjs)
  - **CLI Stabilization**: `electron/cli.cjs`에 5초 타임아웃 및 로컬 파일 Fallback 로직 추가.
  - **CLI Refactoring**: `useCliHandlers.ts` 후크를 통해 `CliApp.tsx`의 로직을 분리하여 유지보수성 향상.
  - **Bug Fix**: `analyze-diff` 명령 실행 시 `LogProcessor.worker`와 `SplitAnalysis.worker` 사이의 데이터 필드명 불일치(`metrics` -> `sequence`) 수정. 🐧🛠️⚡
  - `Headless Manager`: [CliApp.tsx](./CliApp.tsx)
  - `Command Handlers`: [useCliHandlers.ts](./hooks/useCliHandlers.ts) [REFACTORED]
- **Core Interface**:
  - `analyze-diff`: 두 로그 분석 및 JSON 리포트 생성. 500줄 이하 유지 보증.
  - `Connection Fallback`: 개발 가상화(WSL) 환경에서 Vite 서버 연결 지연 시 빌드 파일로 즉시 전환 [HOT]
- **Data Flow**: `Terminal Argv` -> `commander (cli.cjs)` -> `BrowserWindow (Hidden)` -> `index.tsx` -> `CliApp.tsx` -> `useCliHandlers.ts` -> `Task Execution` -> `Terminal Output`

### [[Log Viewer UI Architecture]]
- **ID**: `ui-log-viewer-hierarchy`
- **Keywords**: [`로그 뷰어`, `렌더러`, `virtual scroll`, `pane`, `HyperLogRenderer`]
- **Location**:
  - `Container`: [LogSession.tsx](./components/LogSession.tsx)
  - `Pane`: [LogViewerPane.tsx](./components/LogViewer/LogViewerPane.tsx)
  - `Renderer`: [HyperLogRenderer.tsx](./components/LogViewer/HyperLogRenderer.tsx)
  - `RawContextViewer`: 로그 라인 더블 클릭 시 원본 로그 문맥을 보여주는 오버레이 뷰. `z-index` 충돌 문제 해결 및 `LogSession`에서의 중복 정의 제거. [NEW]
  - `SplitRawContextViewer`: Timeline 항목 더블 클릭 시 좌우 로그의 원본 문맥을 동시에 보여주는 분할 뷰어. [NEW]
- **Interactions**:
  - `Scroll`: 가상 스크롤을 통한 세그먼트 단위 로딩 (`onScrollRequest`)
  - `Ctrl+F`: 검색 바 활성화
  - `Double Click`: 북마크 토글
  - **라인 넘버 토글(Show Line Numbers)**: 거터(Gutter)의 인덱스(#)와 원본 라인 번호를 선택적으로 숨길 수 있는 기능을 추가했습니다. 화면을 가로로 더 넓게 쓰고 싶을 때 유용하며, `View Settings`에서 토글 가능합니다. [NEW]
  - **Happy Combo Section**: `Zap` 아이콘 기반의 강력한 필터링 규칙 관리.
    - **마스터 토글**: "Happy Combos" 헤더의 체크박스로 미션 내 모든 해피콤보를 한 번에 켜고 끌 수 있음. [NEW]
    - **Root/Branch 관리**: 트리 구조로 로그 태그를 그룹화하여 관리. Root는 OR, Branch는 AND 조건으로 매칭.
  - **스플릿 뷰 스마트 스텝(Split Smart Step Shortcuts)**: `Ctrl + Shift + Left/Right Arrow` 단축키를 통해 스플릿 뷰의 비중을 단계적으로(0.1 ↔ 0.5 ↔ 0.9) 조절할 수 있습니다. [NEW]
    - `Left Arrow`: 오른쪽 방향에서 한 단계씩 왼쪽으로 이동 (Right → Mid → Left)
    - `Right Arrow`: 왼쪽 방향에서 한 단계씩 오른쪽으로 이동 (Left → Mid → Right)
  - **Analyze Diff UI Tabs**:
    - **Timeline Tab**: 전체 세그먼트를 시간순으로 나열하고 각 지점별 성능 차이를 시각화 🐧⏳
    - **Jump Feature**: 세그먼트 클릭 시 해당 로그 위치로 즉시 이동 및 좌우 싱크 정렬 🐧🚀
### Analyze Diff (Split Analysis)
- 두 로그간의 시간 차이 및 로그 발생 빈도 차이를 정밀 분석
- **Summary**: Regression, Improvement, Stable, New Log 카테고리별 요약 제공
- **Timeline**: 전체 로그 흐름을 시간순으로 비교하며 네비게이션 제공
- **Resizable Layout**: 상단 정보창과 로그창 사이의 경계선을 드래그하여 높이 조절 가능 (설정값 자동 저장)
- **Persistence**: 조절된 높이값은 Local Storage(`splitAnalyzerHeight`)에 저장되어 세션간 유지됨
        - 📊 **Summary Tab**: 3컬럼 레이아웃 및 동적 필터링 기반 분석 🐧⚡
            - **상단 요약 필터 카드**: [Total] [Regressions] [Improvements] [Stable] [New Logs] 순 배치 (숫자 크기 대폭 확대 `text-3xl`)
            - **3컬럼 리스트 구조**: 좌측(Flow) | 중앙(Status) | 우측(Metrics) 배치를 통해 Timeline과 통일된 디자인 제공
            - **Dynamic List**: 상단 카드 선택 시 왼쪽 리스트 영역이 즉시 필터링됨 (Regressions, Improvements, Stable)
            - **Static List**: 'New Logs'는 우측 영역에 상시 고정 노출
            - **±20ms Threshold**: 성능 차이가 20ms 이내인 노드는 'STABLE'로 자동 분류 🐧⚖️
  - **스플릿 뷰 렌더링 최적화**: 뷰포트 너비가 크게 변할 때(스플릿 모드 진입 등) 가로 스크롤을 자동으로 0으로 리셋하여 왼쪽 패널의 타임스탬프/로그레벨이 가려지는 현상을 완벽히 해결했습니다. [FIX]

### [[Split Performance Analyzer]]
- **ID**: `ui-split-analyzer`
- **Keywords**: [`성능 분석`, `Split Analysis`, `Regression`, `Improvement`, `Delta Change`]
- **Location**:
  - `Panel`: [SplitAnalyzerPanel.tsx](./components/LogViewer/SplitAnalyzerPanel.tsx) [REFACTORED]
  - `Worker`: [SplitAnalysis.worker.ts](./workers/SplitAnalysis.worker.ts)
  - `Hook`: [useSplitAnalysis.ts](./hooks/useSplitAnalysis.ts)
- **Features**:
  - **2단 레이아웃(Timeline|Metrics)**: 실행 흐름(시작점 ↓ 종료점)과 시간 분석 데이터(LEFT|RIGHT|REG)를 수직으로 분리하여 가독성 극대화. [NEW]
  - **정밀 구간 매칭(Source-to-Source)**: 파일명, 함수명, 라인번호를 조합한 시그니처 기반 정밀 분석. [NEW]
  - **신규 로그 분석(New Logs Only)**: 왼쪽에 없는데 오른쪽에만 새롭게 등장한 로그(파일명:함수:라인 기준)를 자동으로 추출하여 발생 건수와 함께 표시. [NEW]
  - **정밀 포인트 내비게이션(< >)**: 동일한 로그 지점이 여러 번 발생했을 경우, 리스트에서 화살표 버튼을 통해 모든 발생 지점을 순차적으로 점프하며 확인 가능. [NEW]
  - **파일 순서 기반 분석**: 스레드(TID)에 구애받지 않고 로그 파일의 물리적 순서대로 구간을 생성하여 직관성 확보
  - **Baseline 기반 비연속 매칭(Search)**: 왼쪽 로그를 기준으로 오른쪽 로그에서 슬라이딩 윈도우를 이용해 비연속 매칭을 수행함으로써 중간에 삽입된 로그가 있어도 정확한 구간 비교 가능
  - **코드 라인 연동**: 로그 내부에서 추출한 코드 라인 번호를 우선 노출하여 소스 코드와의 연결성 강화.
  - **초슬림 모드**: 카드 높이를 획기적으로 낮춰 대량의 분석 결과를 효율적으로 탐색 가능하도록 최적화. [NEW]
  - **참고**: `Analyze Diff` 버튼은 현재 `TopBar.tsx` 내의 `ENABLE_SPLIT_ANALYZE_BUTTON` 플래그로 인해 UI에서 보이지 않도록 설정되어 있습니다. [HIDDEN]
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
  - `UI Polish`: 불필요한 UUID 정보를 제거하고 UI 전체를 영문화하여 시인성을 높였습니다. [NEW]

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
  - `Ctrl+C`: **선택된 라인이 있을 경우 해당 라인만 복사하도록 개선**. 선택 영역이 없으면 기존처럼 전체 복사 유지. [NEW]
  - `Tab Header Button`: **Copy as Confluence Table 버튼은 현재 선택 여부와 상관없이 항상 전체 필터링된 로그를 복사**하도록 정책 고정! [MOD]
  - `Shift + Click`: 범위 선택
  - **최근 개선 (Big Log Fix)**: 1GB 이상 대용량 로그 필터링 시 페이지(Segment Index)가 초기화되지 않아 화면이 비어 보이던 버그 해결. 
  - **최근 최적화 (Extreme Performance)**: 
    - **Loading Splash & Plugin Lazy Mount**: 앱 초기 로딩 시 모든 플러그인을 한꺼번에 마운트하여 메인 스레드를 점유하던 병목을 해결했습니다. `PluginContainer`에 지연 마운팅(Lazy Mount)을 도입하여 활성화된 적이 있는 플러그인만 메모리에 유지하도록 개선, 로딩 화면의 애니메이션이 끊김 없이 부드럽게 동작하도록 최적화했습니다. [TURBO]
    - **WASM Cold Start & JIT 예열 완벽 해결**: 앱 최초 실행 시 V8 엔진의 JIT 컴파일 지연과 WASM 초기화 미동기화로 인해 첫 필터링이 JS Fallback으로 빠지며 5.5초가 걸리던 고질적 문제를 완전히 뽑았습니다! 인덱싱과 동시에 워커를 스폰(`initSubWorkers`)하고, 더미 텍스트로 5만 번 엔진을 예열하여 첫 필터링도 무조건 3초대 최고 속도를 냅니다. [TURBO]
    - 필터링 시 동시 RPC 요청을 4개로 제한(Throttling)하여 IPC 부하 및 메모리 스파이크 차단. [STABLE]
    - 청크당 라인수를 최대 20,000개로 제한하여 Electron IPC 대역폭 초과 방지. [RELIABLE]
    - 서브 워커에서 대용량 문자열 split 대신 Uint8Array 직접 순회 방식으로 변경하여 OOM 완전 차단. [ZERO-COPY]
    - **초거대 용량 동적 스케일링(Dynamic Strategy)**: 파일 전체 라인 수(`totalLines`)에 비례하여 처리 청크 크기와 워커 동시성(Concurrency)을 가변적으로 조절하는 **지능형 엔진**을 탑재했습니다. 
      - **500만 줄 초과**: 최대 250,000줄 청크 단위 처리, 가용 코어 수 초과 동원(동시성 강화)하여 극한의 처리 속도 확보. (RPC 통신량 최소화) [DYNAMIC]
      - **일반 용량(100만 줄 이하)**: 20,000줄 짧은 청크로 잘게 쪼개어 UI 병목을 분산, 즉각적인 체감 반응속도 향상.
    - **필터 결과 렌더링 RPC 병목 해결**: 대용량 로컬 파일에서 듬성듬성 떨어진 필터 결과 라인들을 화면에 그릴 때, 기존에 1줄씩 "수백 번"의 RPC 통신을 치던 심각한 병목을 **스마트 간격 병합(Gap Merge) 및 `Promise.all` 병렬 통신**으로 교체하여 8초의 렌더링 지연을 1초 미만으로 박살냈습니다! (Zero-IPC-overload) [TURBO]
    - 대규모 텍스트 디코딩 루프 내의 무거운 **정규식 매칭(`.replace()`)을 제거하고 바이트 레벨 비교**로 대체하여 단일 코어 처리 속도 극한 최적화. [TURBO]
    - 최대 지원 라인수를 20M으로 상향하여 초고밀도 로그 파일 대응. [SCALABLE]
    - **수정 (Export Policy)**: Confluence 테이블 복사 시, 기존 `||` (Jira/Confluence 레거시 표기법) 대신 **표준 Markdown 형식(`|---|---|`)**을 적용하여 최신 Confluence 에디터에서 완벽하게 표(Table)로 인식하도록 수정했습니다. 또한, 특수문자(`{`, `}`, `[`, `]`)를 **전각 문자(｛, ｝, ［, ］)**로 교체하여 시각적 차이 없이 Confluence 파서의 오동작을 100% 차단했습니다. `|` 문자는 전각 파이프(`｜`)로 대체하여 데이터 손실 없이 테이블 구조를 보호합니다! [MOD]

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
- [x] **Speedscope Analyzer**
    - **ID**: `plugin-speed-scope`
    - **Keywords**: [`Speedscope`, `Flame Graph`, `Performance Analysis`, `CPU Profile`]
    - **Location**:
        - `View`: [SpeedScopePlugin.tsx](./components/SpeedScope/SpeedScopePlugin.tsx)
        - `Worker`: [SpeedScopeParser.worker.ts](./workers/SpeedScopeParser.worker.ts)
    - **Features**:
        - **Speedscope 포맷 완벽 대응**: `evented` 및 `sampled` 프로파일 형식 지원.
        - **고급 색상 시스템**: 함수 이름 기반 해싱 컬러링에 파스텔 톤다운 적용.
        - **Fail Threshold & Fail Only**: 실시간 성능 필터링 지원. [HOT]
        - **검색 & 태그**: 대소문자 무시 검색 및 태그 기반 필터링. [HOT]
        - **Self Time 계산**: 순수 실행 시간 통계 자동 산출.
        - **Interactive Detail View**: 인스턴스별 통계 및 호출 스택(Stack Trace) 제공.
        - **Analyze Diff (프로파일 비교)**: 두 JSON 프로파일 간 성능 차이 분석 및 시각화. 🐧⚡
    - **Data Flow**: `Raw Data` -> `SpeedScopeParser` -> `PerfDashboard` -> `SplitAnalysisWorker` -> `SplitAnalyzerPanel`

#### [[Milestone Timeline Board]] [NEW] 🚩
성능 타임라인 상에 중요한 기점을 시각화하여 복잡한 구간 내에서 내비게이션을 돕는 기능입니다.
- **ID**: `feature-perf-milestone`
- **Location**:
  - `UI`: [PerfMilestoneBar.tsx](./components/LogViewer/PerfDashboard/PerfMilestoneBar.tsx)
  - `Layout`: [PerfChartLayout.tsx](./components/LogViewer/PerfDashboard/PerfChartLayout.tsx)
  - `Logic`: [usePerfDashboardState.ts](./components/LogViewer/usePerfDashboardState.ts)
- **Features**:
  - **자동 마일스톤**: 로그 내 특정 키워드(`OnCreate`, `OnResume`, `Finished` 등) 감지 시 자동 깃발 생성
  - **사용자 정의 마일스톤**: 차트 영역 **우클릭(Right Click)**으로 원하는 지점에 즉시 마일스톤 추가 가능 [NEW]
  - **Interaction**: 깃발 클릭 시 해당 시점으로 즉시 이동, 호버 시 하단 툴팁으로 상세 정보 확인
- **Data Flow**: `Raw Data` -> `SpeedScopeParser` -> `PerfDashboard` -> `SplitAnalysisWorker` -> `SplitAnalyzerPanel`

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
- **Keywords**: [`BlockTest`, `Scenario`, `Pipeline`, `Automation`, `블록테스트`, `자동화`, `Runner`]
- **Location**:
  - `Main Component`: [index.tsx](./components/BlockTest/index.tsx)
  - `Hook`: [useBlockTest.ts](./components/BlockTest/hooks/useBlockTest.ts)
  - `Runner View`: [PipelineRunner.tsx](./components/BlockTest/components/PipelineRunner.tsx), [ScenarioRunner.tsx](./components/BlockTest/components/ScenarioRunner.tsx)
- **Core Interface**:
  - `executePipeline()` & `executeScenario()`: 블록 단위 테스트 묶음 실행 및 Socket.io 기반 원격 제어
  - **그래프 뷰(Graph View) 기본화**: 시나리오 및 파이프라인 실행 시 시각적 흐름 파악을 위해 'Graph View'가 기본 레이아웃으로 동작하도록 설정 (사용자 선택 시 리스트 뷰 전환 및 영속화 지원). [MOD][HOT]
  - **CLI 연동**: GUI 환경뿐만 아니라 `Headless CLI`를 통해서도 미리 저장된 Scenario 및 Pipeline 실행을 완벽하게 지원합니다. [NEW]
  - **UI 개선**: Electron `title-drag` 영역 내 버튼 클릭 이슈 해결을 위해 모든 헤더 버튼에 `no-drag` 클래스 적용 및 오타 수정. [FIX]

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
  - `Copy Command`: 설정창 내에서 CLI 실행 명령어를 즉시 클립보드에 복사 가능 [NEW]

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

### [[Analyze Diff & Sequence Matching]]
- **ID**: `logic-analyze-diff-sequence`
- **Keywords**: [`로그 비교`, `Analyze Diff`, `Sequence Matching`, `Anchor Sync`, `Alias Matching`, `Happy Combo Alias`]
- **Location**:
  - `Hook`: [useSplitAnalysis.ts](./hooks/useSplitAnalysis.ts)
  - `Worker (Matching)`: [SplitAnalysis.worker.ts](./workers/SplitAnalysis.worker.ts)
  - `Utility`: [SplitAnalysisUtils.ts](./workers/SplitAnalysisUtils.ts)
- **Core Interface**:
  - `Alias Sequence Matching`: Happy Combo의 Alias를 사용하여 좌우 로그에서 '순서대로' 동일한 이벤트를 찾아 시간을 비교합니다. (N번째 Alias A vs N번째 Alias A)
  - `Alias Interval Analysis`: 인접한 앨리어스 사이의 '구간 소요 시간'을 분석하여 좌우 로그 간의 성능 차이를 정밀하게 비교합니다. (Alias A ➔ Alias B 구간 비교) [NEW] [HOT]
  - **Analyze Diff CLI 지원**: 터미널에서 `analyze-diff` 명령을 통해 두 로그의 비교 결과를 즉시 JSON 파일로 저장할 수 있습니다. 경량화된 데이터 구조와 시간순 정렬로 가독성을 극대화했습니다. [NEW]
  - `Strict Segment Synchronization`: 세그먼트 매칭 시 단순히 Alias뿐만 아니라 파일명(fileName), 함수명(functionName), 코드 라인 번호(codeLineNum)까지 모두 일치해야 동일 구간으로 인식하도록 검증 룰을 극도로 강화하여, 서로 다른 영역의 로그가 잘못 묶여 좌우 패널의 동기화가 어긋나는 버그를 원천 차단했습니다. UT 검증 완비! [FIX][HOT]
  - `UI Visual Index Sync`: UI 클릭 시 0-based visual index 기반 이동 로직에서 불필요한 1차감을 제거하여 지점(Segment Interval) 이동 시 정확한 라인으로 스크롤 되도록 오프셋 에러 수정. [FIX]
  - `Segment Deduplication`: 시각적 범위(Line Number Range)가 동일한 세그먼트가 중복 노출되지 않도록 워커 단에서 Deduplication 수행. (Alias 정밀 분석 결과 우선순위 적용) [FIX][HOT]
  - `Global Alias Batch Analysis`: 동일한 이름의 Alias가 여러 번 발생할 경우, 첫 번째부터 마지막까지를 하나의 거대 세그먼트로 묶어 전체 소요 시간을 비교 분석합니다. `isGlobalBatch` 플래그를 통해 리스트 최상단에 고정 노출되며, UI에서 보라색(Violet) 테마와 배지로 특별 강조됩니다. [NEW][HOT]
  - `Anchor Sync`: 사용자가 지정한 패턴(Anchor)을 기준으로 매칭 지점을 찾아 구간별 시간 차이를 정밀 분석합니다. [PLANNED]
- **데이터 흐름**: `Log Workers (Left/Right)` -> `extractAliasEvents` -> `SplitAnalysisWorker` -> `Sequence/Interval Comparison` -> `AnalysisResults UI`
- **최근 개선**:
  - 기존의 '연속된 2줄' 기반 비교 방식의 한계를 극복하기 위해, **LCS(Patience Diff 변형) 기반의 글로벌 시퀀스 매칭 엔진**을 도입했습니다. 이제 로그 내용이 중간에 대폭 달라지거나 삽입/삭제가 발생해도 핵심 앵커(Anchor)를 기준으로 정확하게 성능 차이를 추적합니다! (Bioinformatics 기술 응용) [TOTAL RE-ARCH]
  - **Burst Grouping (반복 로그 그룹화)**: 연속적으로 발생하는 동일한 로그(예: polling 로그)를 하나의 'Burst' 객체로 자동 병합하여 리스트를 간소화합니다. 첫 로그 위치를 점프 기준으로 유지하고, 마지막 위치는 `burstEndLineNum` 필드에 보존합니다. 클릭 시 첫~마지막 발생 범위로 양쪽 패널이 정확히 이동합니다. [NEW][HOT]
  - **N:M 반복 앵커 매칭 & Gap DP 백트래킹 최적화**: OnError처럼 양쪽에서 반복적으로 발생하는 동일 로그들을 다루기 위해 N:M 매칭과 Gap DP를 조합했습니다. 특히, Gap DP(LCS 기반) 시 **중복 로그 배열(`[A]` vs `[A, A]`)을 만나면 항상 뒤에 위치한 항목과 우선 매칭하던 역방향 추적의 본질적 결함을 해결 (First Match Prefer 로직 도입)** 하여 반복 로그가 항상 순서대로 매칭되도록 엔진을 고도화했습니다. [FIX][HOT]
  - **Whitespace Normalization**: 로그 본문의 공백 수 차이(Space/Tab noise)를 무시하고 동일한 의미의 로그로 인식하여 매칭 정확도를 비약적으로 높였습니다. [NEW]
  - **Order-preserved Result Analysis**: `metrics` 객체 기반의 순서 뒤섞임 문제를 해결하고, 로그 파일의 물리적 순서 그대로 분석 결과를 도출하도록 엔진을 전면 개편했습니다. [STABLE]

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
- **Description**: 터미널 환경에서 백그라운드로 대규모 로그 추출기(Log Extractor)와 자동화 시나리오(BlockTest)를 구동하는 방법 및 예제를 담은 매뉴얼입니다.

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
> **형님, 패키징 시 발생하던 파일 잠금 문제까지 완벽하게 해결되었습니다!** 이제 프로세스 충돌 걱정 없이 빌드하시면 됩니다!
