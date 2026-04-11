# HAPPY Tool - Application Map

## 🧩 Plugins

### [Log Analysis Agent](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/LogAnalysisAgent)
로그 분석을 자동화하는 AI 에이전트 플러그인입니다.
- **UI Components**:
  - `AgentConfigPanel`: 분석 모드, 미션 필터, 로그 소스 및 분석 실행 버튼을 포함하는 메인 설정 패널.
    - **Update (2026-04-03)**: 버튼 높이를 키워 시각적 강조 효과 부여 (`py-7`, `py-6.5` 적용).
    - **Update (2026-04-03)**: 상단 타이틀 바에 'Debug Mode' 토글 추가.
    - **Update (2026-04-03)**: 디버그 모드 시 LLM과의 원문 통신 내역(Request/Response JSON)을 확인할 수 있는 'LLM Communication' 탭 추가.
    - **Update (2026-04-03)**: 섹션별 `card-gradient` 및 좌우 그라데이션 유리 효과(Gradient Glass Effect) 적용으로 프리미엄 UI 구현.
  - `AgentThoughtStream`: 에이전트의 사고 과정 및 진행 상태를 시퀀셜하게 보여주는 뷰어.
  - `FinalReportViewer`: 최종 분석 보고서를 마크다운 형식으로 렌더링.

### [RAG Analyzer Test](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/RagAnalyzerTest/index.tsx) [NEW]
RAG 서버와 연동하여 이슈 분석 힌트를 검색하는 테스트용 플러그인입니다.
- **UI Components**:
  - `RagAnalyzerTest`: 메인 검색 인터페이스.
    - **Update (2026-04-11)**: 인디고/퍼플 그라데이션 기반의 프리미엄 카드 UI 적용.
    - **Update (2026-04-11)**: 500ms Debounce 검색 로직 및 서버 상태(8888 포트) 실시간 모니터링 기능 탑재.
- **Interactions**:
  - 검색 결과 유사도(`distance`)를 별점(Star Rating)으로 시각화.
  - Root Cause 및 Resolution 힌트 카드형 레이아웃 제공.

## 🏗️ UI Components

### [Log Extractor](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogExtractor.tsx)
로그 추출 및 실시간 스트리밍 기능을 제공합니다.
- **Log Settings**: 'Start Logging' 버튼 (인디고 테마의 솔리드 버튼의 기준 디자인).
- **Interactions**: `Alt + Mouse Double Click` 시 하이라이트 토글, `Alt + Mouse Right Click` 시 모든 퀵 하이라이트 일괄 해제 기능 구현.
- **Bookmarks Modal Export (2026-04-10)**:
  - **Confluence Table Fix**: `utils/confluenceUtils.ts` — 'Copy as Confluence Table' 실행 시 UI와 동일하게 'Acc. Time' 컬럼을 포함하도록 마크업 생성 로직 개선 및 UI 데이터 동기화 최적화.
  - **Original Line Number Support**: `BookmarksModal.tsx` — 내보내기 시 가상 인덱스 대신 원본 라인 번호(`# 123` 등)를 우선 사용하도록 데이터 매핑 안정화.
- **Export Logic Enhancement (2026-04-10)**:
  - **Full Filtered Export**: `LogViewerToolbar.tsx` 및 `hooks/useLogExportActions.ts` — 'Copy Filtered Logs' 및 'Save Filtered Logs' 버튼 클릭 시, 선택 영역 유무와 관계없이 항상 **필터링된 전체 로그**를 대상으로 동작하도록 로직 고도화.
    - [Export Logic] Toolbar buttons export full filtered logs (`ignoreSelection: true`), while `Ctrl+C` respects current selection (`ignoreSelection: false`).
    - [Export Logic Fix (Active)]: `Ctrl+C` now respects line selection by forcing `ignoreSelection: false` in both `LogViewerPane` and `LogSession` global listeners. [NEW: Global handler fix in LogSession.tsx]
    - [Ctrl+C Override] Prioritizes browser text selection. If none, copies app-level selected lines. If no selection exists, does nothing (to prevent accidental full log export). [Fixed] Direct state reference used to ensure perfect sync.
  - **Transaction Analysis Fix (2026-04-10)**:
    - **Worker Regex Fix**: `workers/workerAnalysisHandlers.ts` — PID/TID 추출용 정규표현식 오류(불필요한 공백/오타) 수정으로 분석 기능 정상화.
    - **Context Menu UI**: `components/LogSession.tsx` — "Analyze PID: 1234", "Analyze TID: 5678" 등 직관적인 레이블 개선 및 Tag 분석 연동 안정화.

### [SpeedScope Analyzer](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/SpeedScope/SpeedScopePlugin.tsx)
- **Unified Diff Mode v2 (2026-04-06)**: 두 프로파일의 성능 차이를 직관적으로 분석하는 고대화된 비교 모드.
  - **Matching Engine v2**: `utils/performanceDiff.ts` — Greedy best-match + position-ratio 기반 정밀 매칭. Removed 세그먼트 추적.
  - **Function Diff Statistics**: 함수별 성능 변화 집계 및 시각화 연동.
  - **Layout Reconstruction (2026-04-06)**: 
    - **Flex-Col Backbone**: 상위부터 하단 패널까지 이어지는 엄격한 Flex 위계 수립.
    - **Min-Height Zero (min-h-0)**: 자식 요소가 부모 영역을 침범하지 않도록 강제 축소 로직 적용.
    - **Responsive Scaling**: 화면 비율에 따라 FlameGraph와 통계 패널이 유연하게 리사이징되는 구조.
  - **기존 싱글 뷰**: 레이아웃 안정화 작업의 혜택을 동일하게 받으며, 화면 잘림 현상 원천 해결.

### [NetTraffic Analyzer](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/NetTrafficAnalyzer/NetTrafficAnalyzerPlugin.tsx)
- **GUI & CLI Unified Core (2026-04-07)**:
  - **AppSettings Integration**: 기존 `localStorage`에 개별 저장되던 트래픽 패턴과 UA 추출 템플릿을 전역 앱 설정(`AppSettings`)으로 통합.
  - **CLI Sync Engine**: CLI 실행 시 GUI에서 마지막으로 설정된 'Detection keywords', 'Extraction Template', 'Traffic Rule'을 실시간으로 동기화하여 분석.
  - **Console Summary Output**: CLI 실행 결과 분석 데이터를 터미널에 요약 출력 (Top Endpoints, Regression 히스토리 등).
  - **Strict Pattern Matching**: `NetTraffic.worker.ts` — 사용자의 정밀 추출 Regex(`extractRegex`)를 최우선으로 적용하는 매칭 로직 탑재.

### [BlockTest Plugin](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/BlockTest)
Tizen 기기 테스트를 위한 블록 기반 파이프라인 엔진입니다.
- **Reliability Update (2026-04-08)**: 
  - **Timeout Optimization**: `sdb shell` 명령의 지연 특성을 고려하여 프론트엔드 타임아웃을 10초에서 **12초**로 상향 조정.
  - **Backend Process Guard**: `server/index.cjs` — 명령 실행 시 백엔드 자체 타임아웃(**15초**) 및 좀비 프로세스 방지를 위한 `SIGKILL` 로직 도입.
  - **Enhanced Debugging**: 타임아웃 발생 시 대상 명령어를 로그에 명시하여 트러블슈팅 편의성 증대.

### [Plugin Visibility Management](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/config.ts) [NEW]
- **Management Logic (2026-04-10)**:
  - **Comprehensive Toggle**: `plugins/config.ts` — SmartThings, Tizen, AI Agent 등 14종의 실험실 플러그인 전체에 대해 개별 가시성 플래그 제공.
  - **Registry Filtering**: `plugins/registry.ts` — `visibilityMap` 테이블을 통해 각 플러그인 ID와 설정값을 매핑하여 필터링 수행.

## 🤖 Backend Services & RAG [NEW]

### [SW Issue Analyst RAG](file:///k:/Antigravity_Projects/gitbase/happytool_electron/server/rag_analyzer)
과거 S/W 문제점 사례를 기반으로 신규 이슈에 대한 1차 분석 힌트를 제공하는 RAG 서버입니다.
- **RAG Engine (2026-04-11)**:
  - **Vector DB**: `ChromaDB` (Persistent)를 통한 Semantic Search 구현.
  - **Embedding**: `Sentence-Transformers` (all-MiniLM-L6-v2) 로컬 임베딩 적용 (무료/로컬 실행).
  - **API Server**: `FastAPI` 기반 검색 및 분석 API (포트: 8888).
  - **Data Integrity**: `ingest.py` — ID 기반 **Upsert 로직** 적용으로 인덱싱 중복 방지 및 정합성 강화.
  - **Monitoring**: `main.py` — 실시간 검색 쿼리 및 성능 메트릭 **로깅 시스템** 구축 (`rag_server.log`).
- **Process Management (2026-04-11)**:
  - **Lifecycle Guard**: `electron/main.cjs` — Electron 메인 프로세스에서 파이썬 서버 기동/종료를 직접 관리 (`spawn` & `SIGTERM`).
  - **UI Integration**: `components/RagAnalyzerTest/index.tsx` — 플러그인 상단에 **서버 시작(Start Server) 버튼**과 실시간 상태 인디케이터 연동.
- **Tools**:
  - `ingest.py`: 데이터 인덱싱 스크립트.
  - `test_query.py`: 검색 테스트용 CLI 클라이언트.

---
*Last Updated: 2026-04-11 (RagAnalyzerTest Plugin Added)*
