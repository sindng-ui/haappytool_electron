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
    - **Update (2026-04-11)**: **RAG 통합 및 서버 자동 관리** 기능 추가.
      - 플러그인 진입 시 RAG 서버(`localhost:8888`) 자동 실행 로직 탑재.
      - `AgentConfigPanel`: 인디고 스타일의 RAG 검색창 추가. 500ms 디바운스 검색 및 유사 사례 상위 3개 노출.
      - 선택된 RAG 힌트를 AI 분석의 초기 컨텍스트(`initial_hints`)에 포함하여 분석 정밀도 대폭 향상.
  - `AgentThoughtStream`: 에이전트의 사고 과정 및 진행 상태를 시퀀셜하게 보여주는 뷰어.
  - `FinalReportViewer`: 최종 분석 보고서를 마크다운 형식으로 렌더링.
- **Stability & Fixes (2026-04-16)**:
  - **State Management Fix**: `useAnalysisAgent.ts` — 분석 루프에서의 stale closure 이슈를 해결하여 타임아웃 시에도 최신 상태의 리포트가 생성되도록 개선.
  - **Test Suite Recovery**: API 응답 스키마(`AgentResponseWithMeta`) 변경에 맞춰 유닛 테스트(`agentApiService.test.ts`, `useAnalysisAgent.test.ts`)의 mock 데이터 구조를 전면 동기화하여 테스트 신뢰성 확보.

### [RAG Analyzer Test](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/RagAnalyzerTest/index.tsx) [NEW]
RAG 서버와 연동하여 이슈 분석 힌트를 검색하는 테스트용 플러그인입니다.
- **UI Components**:
  - `RagAnalyzerTest`: 메인 검색 인터페이스.
    - **Update (2026-04-11)**: 인디고/퍼플 그라데이션 기반의 프리미엄 카드 UI 적용.
    - **Update (2026-04-11)**: 500ms Debounce 검색 로직 및 서버 상태(8888 포트) 실시간 모니터링 기능 탑재.
    - **Update (2026-04-27)**: **Header Standardization**. 제로-사이드바 환경에 맞춰 헤더 높이를 `h-16`으로 압축하고, 플로팅 아이콘 영역 확보를 위해 `pl-16` 패딩 적용. 타이틀 레이아웃을 더 컴팩트하게 개선. 🐧✨
- **Interactions**:
  - 검색 결과 유사도(`distance`)를 별점(Star Rating)으로 시각화.
  - Root Cause 및 Resolution 힌트 카드형 레이아웃 제공.

### [Nupkg Signer](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/NupkgSigner) [NEW]
.NET nupkg 파일의 `.so` 바이너리를 추출하고, 서명된 파일로 교체하여 다시 패키징하는 도구입니다.
- **UI Components**:
  - `NupkgSigner`: 4단계 마법사(Wizard) 형태의 메인 UI. 프리미엄 스텝 바 및 드래그 앤 드롭 지원.
- **Performance Optimization (2026-04-16)**:
  - **Web Worker Offloading**: `workers/nupkg.worker.ts` — 대용량 `.nupkg` 처리 시 UI 스레드 차단을 방지하기 위해 모든 ZIP 압축/해제 로직을 백그라운드로 격리.
  - **Memory Efficiency**: 메인 스레드에서 무거운 `JSZip` 인스턴스를 제거하고, 필요한 데이터만 워커와 주고받는 구조로 개선.
- **Testing & Build Compatibility (2026-04-17)**:
  - `nupkgUtils.test.ts`: 아키텍처 제외 로직 및 바이너리 교체 무결성 검증 완료.
  - **Build Fix**: Worker 빌드 시 `jszip` bare import 해석 실패 문제를 해결하기 위해, Worker 및 관련 유틸에서 standalone UMD 번들(`jszip/dist/jszip.js`)을 직접 import하도록 변경. 어떤 환경에서든 `npm install`만 하면 빌드 가능.
- **Bug Fixes (2026-04-20 & 2026-04-22)**:
  - **Extension Fix**: `Step5_FinalDownload.tsx` — 다운로드 시 파일 확장자가 `.tpk`로 고정되던 문제를 `saveNupkgFile` API 도입으로 해결하여 정상적인 `.nupkg` 저장을 보장.
  - **UI State Sync**: `index.tsx` — 마지막 다운로드 완료 시(`isFinalized`), 상단 스텝 바의 4번 인디케이터가 활성(Indigo) 상태에서 완료(Emerald) 상태로 즉시 전환되도록 로직 개선.
  - **Memory Leak Fix (2026-04-22)**: `main.cjs` — 타임아웃이나 예외 상황 시 자동 서명을 폴링하는 타이머(`setInterval`)가 정상적으로 해제되지 않아 무한 루프에 빠지는 현상 완벽 방어.
  - **Startup Perf Fix (2026-04-22)**: `index.tsx` — Vite의 Worker 번들링 병목(Rollup)을 피하기 위해 Native ESM Worker 방식으로 전환. 초기 로딩 속도 10초 이상 단축.
  - **Global Build Fix (2026-04-27)**: `vite.config.ts` — 워커 내부의 `jszip` 참조 오류를 해결하기 위해 `jszip` 임포트를 벤더 번들(`jszip-bundle.js`)로 강제 연결하는 **Global Alias** 도입. 프로덕션 빌드 무결성 확보. 🐧⚡
- **New Features (2026-04-20)**:
  - **ISMS URL Integration**: `Step2_3_FileList.tsx` — 서명 작업을 위한 ISMS URL 입력창 및 브라우저 열기(`openExternal`) 연동 기능 추가. `localStorage`를 통한 URL 영구 저장 지원.
  - **ISMS Auto Sign (Phase 2)**: `main.cjs`, `index.tsx`, `Step2_3_FileList.tsx` — CDP(Chrome DevTools Protocol)와 가상 브라우저 제어를 통한 자동 서명 기능. `persist:isms` 세션 파티션을 도입하여 앱 내 로그인 상태를 자동화 엔진과 공유하도록 개선.

### [Release History](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/ReleaseHistory/ReleaseHistoryPlugin.tsx) [NEW]
앱 릴리즈 버전을 제품별/릴리즈별로 타임라인과 리스트 형태로 관리하는 도구입니다.
- **UI Components**:
  - `ReleaseHistoryPlugin`: 듀얼 뷰 모드(List/Timeline), 검색 및 Import/Export 제어.
    - **Update (2026-04-24)**: **Premium Toast Notification** 시스템 도입. 기존 `alert()`을 모두 대체하여 흐름을 끊지 않는 세련된 알림 구현.
  - `ListView`: 릴리즈 버전과 노트를 정리된 카테고리로 보여주는 아코디언형 리스트.
    - **Update (2026-04-23)**: 릴리즈 카드에 컬러 코딩된 **태그 배지** 표시 기능 추가.
  - `TimelineGraphView`: 정보를 포함한 작은 카드 형태로 시각화된 2D 타임라인 뷰.
    - **Update (2026-04-23)**: 하단 **타임라인 미니맵(Mini-map)** 추가. 전체 기간 조망 및 드래그 내비게이션 지원.
  - `ReleaseDetailModal` & `AddReleaseModal`:
    - **Update (2026-04-24)**: **Solid & Clean UI** 리뉴얼. 투명도와 배경 글로우를 제거하여 시각적 피로도를 낮추고 성능 최적화.
    - **Update (2026-04-24)**: 마크다운 렌더링 개선 (`whitespace-pre-wrap`, `break-all`). 줄바꿈 유지 및 긴 문자열 삐져나옴 현상 해결.
    - **Update (2026-04-24)**: **Modal Layout Optimization**. 상하 잘림 현상 해결을 위해 `max-height` 조정 및 내부 문서 영역 전용 스크롤 적용. 컨텐츠 밀도 최적화.
    - **Update (2026-04-24)**: **AddReleaseModal Dark UI Fix**. input/textarea 배경색을 inline style로 강제 지정하여 브라우저 기본 흰색 스타일 충돌 해소. 전체 레이아웃 여백 압축 및 사이드바 컴팩트 재설계.
- **Features**:
  - **Tag System**: `Hotfix`, `Feature`, `Major` 등 프리셋 태그 및 사용자 정의 태그 지원. 각 태그별 고유 색상 매핑.
  - JSON Import (Drag & Drop), Markdown Table Copy, Timeline PNG Export 지원.
  - 대용량 데이터 시 렌더링 최적화 (`useMemo` 기반 상태 관리 및 `will-change` 가속).

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
- **Stability Fixes (2026-04-22)**:
  - **Orphaned Stream GC**: `main.cjs` — 대용량 로그 스트리밍 중 브라우저 렌더러가 새로고침되거나 크래시 날 경우, 메모리에 남겨진 스트림들을 일괄 방출(GC)하는 방어 로직을 `web-contents-created` 이벤트에 탑재.

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
- **Stability Fix (2026-04-16)**:
  - **Defensive Data Access**: `hooks/useCliHandlers.ts` — 미션 분석 시 insights 데이터가 유실된 경우에도 크래시가 발생하지 않도록 Optional Chaining 및 Nullish Coalescing Guard 로직 강화.

### [BlockTest Plugin](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/BlockTest)
Tizen 기기 테스트를 위한 블록 기반 파이프라인 엔진입니다.
- **Reliability Update (2026-04-08)**: 
  - **Timeout Optimization**: `sdb shell` 명령의 지연 특성을 고려하여 프론트엔드 타임아웃을 10초에서 **12초**로 상향 조정.
  - **Backend Process Guard**: `server/index.cjs` — 명령 실행 시 백엔드 자체 타임아웃(**15초**) 및 좀비 프로세스 방지를 위한 `SIGKILL` 로직 도입.
  - **Enhanced Debugging**: 타임아웃 발생 시 대상 명령어를 로그에 명시하여 트러블슈팅 편의성 증대.

### [AppHub](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/AppHub.tsx) [NEW]
앱 라이브러리 및 설정을 호출하는 메인 진입점 컴포넌트입니다.
- **UI Features**:
  - **Quick Access Orbit**: 호버 시 설정 버튼이 나타나는 애니메이션 인터페이스.
  - **Status Indicator (2026-04-29)**: 우상단 알림 점(Dot) 색상을 핑크에서 **에메랄드(그린)**로 변경하여 시각적 안정성 강화. 🐧💚

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
- **Process Management (2026-04-11 & 2026-04-22)**:
  - **Lifecycle Guard**: `electron/main.cjs` — Electron 메인 프로세스에서 파이썬 서버 기동/종료를 직접 관리 (`spawn` & `SIGTERM`).
    - **Update (2026-04-16)**: 패키징 시 `.asar` 내부의 파이썬 실행 불가 문제 해결을 위해 `asarUnpack` 적용 및 `app.asar.unpacked` 경로 참조 로직 추가.
    - **Startup Optimization (2026-04-22)**: 백엔드 서버 로딩과 UI 렌더링 완료 대기를 분리하여, 서버가 준비되는 즉시 스플래시 화면을 종료하도록 `main.cjs` 로직 고도화.
  - **UI Integration**: `components/RagAnalyzerTest/index.tsx` — 플러그인 상단에 **서버 시작(Start Server) 버튼**과 실시간 상태 인디케이터 연동.
- **Tools**:
  - `ingest.py`: 데이터 인덱싱 스크립트. (로컬 `models/` 폴더 우선 로직 및 SSL 우회 탑재)
  - `test_query.py`: 검색 테스트용 CLI 클라이언트.
  - `.gitignore`: `chroma_db`를 Git에 포함하고 `models/`를 제외하도록 설정됨.

## 📜 Standard Guides [NEW]

### [Code Review Guide](file:///k:/Antigravity_Projects/gitbase/happytool_electron/important/CODE_REVIEW_GUIDE.md)
형님(USER)의 요청에 따른 통합 코드 리뷰 시스템의 지침서입니다.
- **5대 핵심 지표**: App Perf, Change Perf, Regression, RAM & CPU, Big File.
- **Workflow**: `/code-review` 명령어 입력 시 가동되는 자동 분석 시스템.

### [Dependency Issues Guide](file:///k:/Antigravity_Projects/gitbase/happytool_electron/docs/DEPENDENCY_ISSUES.md) [NEW]
신규 node 모듈 추가 시 발생하는 환경 이슈(프록시, 빌드 에러)와 해결 사례를 모아놓은 지식 창고입니다.
- **주요 사례**: JSZip (Vite Worker & Proxy Conflict)
- **핵심 전략**: Public Vendor화, Runtime Loading, Type-Only Import.

- **Build & Reliability Enhancements (2026-04-22)**:
  - **JSZip Vendor Integration & ESM Patch**: `vendor/jszip-bundle.js` — JSZip 번들을 프로젝트 내부로 소스 코드화하고, `export default`를 수동으로 추가하여 Vite/Rollup의 ESM 임포트 호환성 완벽 해결. (2026-04-27: `vite.config.ts`에 **Global Alias** 설정을 추가하여 모든 워커 및 유틸에서 이 번들을 강제 사용하도록 확정)
  - **Deep Clean Script**: `scripts/deep_clean.cjs` — Vite 캐시(`node_modules/.vite`)와 빌드 잔해를 일괄 정리하는 강력한 초기화 명령어(`npm run clean:deep`) 도입.
  - **Cross-Platform Startup Fix**: `package.json` — `npx cross-env` 도입으로 다양한 OS/Shell 환경에서 동일하게 동작하도록 `electron:dev` 명령어 개선.
  - **Zombie Port Cleanup**: `scripts/deep_clean.cjs` — 3000번 포트를 점유 중인 좀비 프로세스를 추적하여 강제 종료하는 로직 추가.
  - **Host Binding Relaxation**: `vite.config.ts` — `host: '0.0.0.0'` 설정으로 루프백 이슈 및 타 기기 접근성 개선.


### [App Library Modal](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/AppLibraryModal.tsx) [NEW]
앱 전체 모듈을 관리하고 배치하는 중앙 허브(App Hub)입니다.
- **UI Features (2026-04-27)**:
  - **Static Grid System**: 사용자 요청에 따라 드래그 앤 드롭 기능을 제거하고 안정적인 정적 그리드 레이아웃으로 복구.
  - **Core/Labs 섹션**: 'Pin' 버튼을 통해 상단 고정(Core) 영역과 하단(Labs) 영역 간 이동 가능.
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
    - **Update (2026-04-11)**: **RAG 통합 및 서버 자동 관리** 기능 추가.
      - 플러그인 진입 시 RAG 서버(`localhost:8888`) 자동 실행 로직 탑재.
      - `AgentConfigPanel`: 인디고 스타일의 RAG 검색창 추가. 500ms 디바운스 검색 및 유사 사례 상위 3개 노출.
      - 선택된 RAG 힌트를 AI 분석의 초기 컨텍스트(`initial_hints`)에 포함하여 분석 정밀도 대폭 향상.
  - `AgentThoughtStream`: 에이전트의 사고 과정 및 진행 상태를 시퀀셜하게 보여주는 뷰어.
  - `FinalReportViewer`: 최종 분석 보고서를 마크다운 형식으로 렌더링.
- **Stability & Fixes (2026-04-16)**:
  - **State Management Fix**: `useAnalysisAgent.ts` — 분석 루프에서의 stale closure 이슈를 해결하여 타임아웃 시에도 최신 상태의 리포트가 생성되도록 개선.
  - **Test Suite Recovery**: API 응답 스키마(`AgentResponseWithMeta`) 변경에 맞춰 유닛 테스트(`agentApiService.test.ts`, `useAnalysisAgent.test.ts`)의 mock 데이터 구조를 전면 동기화하여 테스트 신뢰성 확보.

### [RAG Analyzer Test](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/RagAnalyzerTest/index.tsx) [NEW]
RAG 서버와 연동하여 이슈 분석 힌트를 검색하는 테스트용 플러그인입니다.
- **UI Components**:
  - `RagAnalyzerTest`: 메인 검색 인터페이스.
    - **Update (2026-04-11)**: 인디고/퍼플 그라데이션 기반의 프리미엄 카드 UI 적용.
    - **Update (2026-04-11)**: 500ms Debounce 검색 로직 및 서버 상태(8888 포트) 실시간 모니터링 기능 탑재.
    - **Update (2026-04-27)**: **Header Standardization**. 제로-사이드바 환경에 맞춰 헤더 높이를 `h-16`으로 압축하고, 플로팅 아이콘 영역 확보를 위해 `pl-16` 패딩 적용. 타이틀 레이아웃을 더 컴팩트하게 개선. 🐧✨
- **Interactions**:
  - 검색 결과 유사도(`distance`)를 별점(Star Rating)으로 시각화.
  - Root Cause 및 Resolution 힌트 카드형 레이아웃 제공.

### [Nupkg Signer](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/NupkgSigner) [NEW]
.NET nupkg 파일의 `.so` 바이너리를 추출하고, 서명된 파일로 교체하여 다시 패키징하는 도구입니다.
- **UI Components**:
  - `NupkgSigner`: 4단계 마법사(Wizard) 형태의 메인 UI. 프리미엄 스텝 바 및 드래그 앤 드롭 지원.
- **Performance Optimization (2026-04-16)**:
  - **Web Worker Offloading**: `workers/nupkg.worker.ts` — 대용량 `.nupkg` 처리 시 UI 스레드 차단을 방지하기 위해 모든 ZIP 압축/해제 로직을 백그라운드로 격리.
  - **Memory Efficiency**: 메인 스레드에서 무거운 `JSZip` 인스턴스를 제거하고, 필요한 데이터만 워커와 주고받는 구조로 개선.
- **Testing & Build Compatibility (2026-04-17)**:
  - `nupkgUtils.test.ts`: 아키텍처 제외 로직 및 바이너리 교체 무결성 검증 완료.
  - **Build Fix**: Worker 빌드 시 `jszip` bare import 해석 실패 문제를 해결하기 위해, Worker 및 관련 유틸에서 standalone UMD 번들(`jszip/dist/jszip.js`)을 직접 import하도록 변경. 어떤 환경에서든 `npm install`만 하면 빌드 가능.
- **Bug Fixes (2026-04-20 & 2026-04-22)**:
  - **Extension Fix**: `Step5_FinalDownload.tsx` — 다운로드 시 파일 확장자가 `.tpk`로 고정되던 문제를 `saveNupkgFile` API 도입으로 해결하여 정상적인 `.nupkg` 저장을 보장.
  - **UI State Sync**: `index.tsx` — 마지막 다운로드 완료 시(`isFinalized`), 상단 스텝 바의 4번 인디케이터가 활성(Indigo) 상태에서 완료(Emerald) 상태로 즉시 전환되도록 로직 개선.
  - **Memory Leak Fix (2026-04-22)**: `main.cjs` — 타임아웃이나 예외 상황 시 자동 서명을 폴링하는 타이머(`setInterval`)가 정상적으로 해제되지 않아 무한 루프에 빠지는 현상 완벽 방어.
  - **Startup Perf Fix (2026-04-22)**: `index.tsx` — Vite의 Worker 번들링 병목(Rollup)을 피하기 위해 Native ESM Worker 방식으로 전환. 초기 로딩 속도 10초 이상 단축.
  - **Global Build Fix (2026-04-27)**: `vite.config.ts` — 워커 내부의 `jszip` 참조 오류를 해결하기 위해 `jszip` 임포트를 벤더 번들(`jszip-bundle.js`)로 강제 연결하는 **Global Alias** 도입. 프로덕션 빌드 무결성 확보. 🐧⚡
- **New Features (2026-04-20)**:
  - **ISMS URL Integration**: `Step2_3_FileList.tsx` — 서명 작업을 위한 ISMS URL 입력창 및 브라우저 열기(`openExternal`) 연동 기능 추가. `localStorage`를 통한 URL 영구 저장 지원.
  - **ISMS Auto Sign (Phase 2)**: `main.cjs`, `index.tsx`, `Step2_3_FileList.tsx` — CDP(Chrome DevTools Protocol)와 가상 브라우저 제어를 통한 자동 서명 기능. `persist:isms` 세션 파티션을 도입하여 앱 내 로그인 상태를 자동화 엔진과 공유하도록 개선.

### [Release History](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/ReleaseHistory/ReleaseHistoryPlugin.tsx) [NEW]
앱 릴리즈 버전을 제품별/릴리즈별로 타임라인과 리스트 형태로 관리하는 도구입니다.
- **UI Components**:
  - `ReleaseHistoryPlugin`: 듀얼 뷰 모드(List/Timeline), 검색 및 Import/Export 제어.
    - **Update (2026-04-24)**: **Premium Toast Notification** 시스템 도입. 기존 `alert()`을 모두 대체하여 흐름을 끊지 않는 세련된 알림 구현.
  - `ListView`: 릴리즈 버전과 노트를 정리된 카테고리로 보여주는 아코디언형 리스트.
    - **Update (2026-04-23)**: 릴리즈 카드에 컬러 코딩된 **태그 배지** 표시 기능 추가.
  - `TimelineGraphView`: 정보를 포함한 작은 카드 형태로 시각화된 2D 타임라인 뷰.
    - **Update (2026-04-23)**: 하단 **타임라인 미니맵(Mini-map)** 추가. 전체 기간 조망 및 드래그 내비게이션 지원.
  - `ReleaseDetailModal` & `AddReleaseModal`:
    - **Update (2026-04-24)**: **Solid & Clean UI** 리뉴얼. 투명도와 배경 글로우를 제거하여 시각적 피로도를 낮추고 성능 최적화.
    - **Update (2026-04-24)**: 마크다운 렌더링 개선 (`whitespace-pre-wrap`, `break-all`). 줄바꿈 유지 및 긴 문자열 삐져나옴 현상 해결.
    - **Update (2026-04-24)**: **Modal Layout Optimization**. 상하 잘림 현상 해결을 위해 `max-height` 조정 및 내부 문서 영역 전용 스크롤 적용. 컨텐츠 밀도 최적화.
    - **Update (2026-04-24)**: **AddReleaseModal Dark UI Fix**. input/textarea 배경색을 inline style로 강제 지정하여 브라우저 기본 흰색 스타일 충돌 해소. 전체 레이아웃 여백 압축 및 사이드바 컴팩트 재설계.
- **Features**:
  - **Tag System**: `Hotfix`, `Feature`, `Major` 등 프리셋 태그 및 사용자 정의 태그 지원. 각 태그별 고유 색상 매핑.
  - JSON Import (Drag & Drop), Markdown Table Copy, Timeline PNG Export 지원.
  - 대용량 데이터 시 렌더링 최적화 (`useMemo` 기반 상태 관리 및 `will-change` 가속).

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
- **Stability Fixes (2026-04-22)**:
  - **Orphaned Stream GC**: `main.cjs` — 대용량 로그 스트리밍 중 브라우저 렌더러가 새로고침되거나 크래시 날 경우, 메모리에 남겨진 스트림들을 일괄 방출(GC)하는 방어 로직을 `web-contents-created` 이벤트에 탑재.

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
- **Stability Fix (2026-04-16)**:
  - **Defensive Data Access**: `hooks/useCliHandlers.ts` — 미션 분석 시 insights 데이터가 유실된 경우에도 크래시가 발생하지 않도록 Optional Chaining 및 Nullish Coalescing Guard 로직 강화.

### [BlockTest Plugin](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/BlockTest)
Tizen 기기 테스트를 위한 블록 기반 파이프라인 엔진입니다.
- **Reliability Update (2026-04-08)**: 
  - **Timeout Optimization**: `sdb shell` 명령의 지연 특성을 고려하여 프론트엔드 타임아웃을 10초에서 **12초**로 상향 조정.
  - **Backend Process Guard**: `server/index.cjs` — 명령 실행 시 백엔드 자체 타임아웃(**15초**) 및 좀비 프로세스 방지를 위한 `SIGKILL` 로직 도입.
  - **Enhanced Debugging**: 타임아웃 발생 시 대상 명령어를 로그에 명시하여 트러블슈팅 편의성 증대.

### [AppHub](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/AppHub.tsx) [NEW]
앱 라이브러리 및 설정을 호출하는 메인 진입점 컴포넌트입니다.
- **UI Features**:
  - **Quick Access Orbit**: 호버 시 설정 버튼이 나타나는 애니메이션 인터페이스.
  - **Status Indicator (2026-04-29)**: 우상단 알림 점(Dot) 색상을 핑크에서 **에메랄드(그린)**로 변경하여 시각적 안정성 강화. 🐧💚

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
- **Process Management (2026-04-11 & 2026-04-22)**:
  - **Lifecycle Guard**: `electron/main.cjs` — Electron 메인 프로세스에서 파이썬 서버 기동/종료를 직접 관리 (`spawn` & `SIGTERM`).
    - **Update (2026-04-16)**: 패키징 시 `.asar` 내부의 파이썬 실행 불가 문제 해결을 위해 `asarUnpack` 적용 및 `app.asar.unpacked` 경로 참조 로직 추가.
    - **Startup Optimization (2026-04-22)**: 백엔드 서버 로딩과 UI 렌더링 완료 대기를 분리하여, 서버가 준비되는 즉시 스플래시 화면을 종료하도록 `main.cjs` 로직 고도화.
  - **UI Integration**: `components/RagAnalyzerTest/index.tsx` — 플러그인 상단에 **서버 시작(Start Server) 버튼**과 실시간 상태 인디케이터 연동.
- **Tools**:
  - `ingest.py`: 데이터 인덱싱 스크립트. (로컬 `models/` 폴더 우선 로직 및 SSL 우회 탑재)
  - `test_query.py`: 검색 테스트용 CLI 클라이언트.
  - `.gitignore`: `chroma_db`를 Git에 포함하고 `models/`를 제외하도록 설정됨.

## 📜 Standard Guides [NEW]

### [Code Review Guide](file:///k:/Antigravity_Projects/gitbase/happytool_electron/important/CODE_REVIEW_GUIDE.md)
형님(USER)의 요청에 따른 통합 코드 리뷰 시스템의 지침서입니다.
- **5대 핵심 지표**: App Perf, Change Perf, Regression, RAM & CPU, Big File.
- **Workflow**: `/code-review` 명령어 입력 시 가동되는 자동 분석 시스템.

### [Dependency Issues Guide](file:///k:/Antigravity_Projects/gitbase/happytool_electron/docs/DEPENDENCY_ISSUES.md) [NEW]
신규 node 모듈 추가 시 발생하는 환경 이슈(프록시, 빌드 에러)와 해결 사례를 모아놓은 지식 창고입니다.
- **주요 사례**: JSZip (Vite Worker & Proxy Conflict)
- **핵심 전략**: Public Vendor화, Runtime Loading, Type-Only Import.

- **Build & Reliability Enhancements (2026-04-22)**:
  - **JSZip Vendor Integration & ESM Patch**: `vendor/jszip-bundle.js` — JSZip 번들을 프로젝트 내부로 소스 코드화하고, `export default`를 수동으로 추가하여 Vite/Rollup의 ESM 임포트 호환성 완벽 해결. (2026-04-27: `vite.config.ts`에 **Global Alias** 설정을 추가하여 모든 워커 및 유틸에서 이 번들을 강제 사용하도록 확정)
  - **Deep Clean Script**: `scripts/deep_clean.cjs` — Vite 캐시(`node_modules/.vite`)와 빌드 잔해를 일괄 정리하는 강력한 초기화 명령어(`npm run clean:deep`) 도입.
  - **Cross-Platform Startup Fix**: `package.json` — `npx cross-env` 도입으로 다양한 OS/Shell 환경에서 동일하게 동작하도록 `electron:dev` 명령어 개선.
  - **Zombie Port Cleanup**: `scripts/deep_clean.cjs` — 3000번 포트를 점유 중인 좀비 프로세스를 추적하여 강제 종료하는 로직 추가.
  - **Host Binding Relaxation**: `vite.config.ts` — `host: '0.0.0.0'` 설정으로 루프백 이슈 및 타 기기 접근성 개선.


### [App Library Modal](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/AppLibraryModal.tsx) [NEW]
앱 전체 모듈을 관리하고 배치하는 중앙 허브(App Hub)입니다.
- **UI Features (2026-04-27)**:
  - **Static Grid System**: 사용자 요청에 따라 드래그 앤 드롭 기능을 제거하고 안정적인 정적 그리드 레이아웃으로 복구.
  - **Core/Labs 섹션**: 'Pin' 버튼을 통해 상단 고정(Core) 영역과 하단(Labs) 영역 간 이동 가능.
  - **Icon Unification**: 모든 모듈 아이콘 크기를 일관성 있게 배치하여 시각적 안정성 확보.
- **Layout Optimization V2 (2026-04-29)**: 사용자 피드백을 반영하여 여백을 더 과감하게 축소. 🐧⚡
  - Header: `px-6 pt-4 pb-3`, 타이틀 간격 `mb-0.5`
  - Content: `py-4`, 섹션 간격 `space-y-8`
  - Section Title: `mb-4`, 아이콘 패딩 `p-1.5`
- **Scrollbar Stabilization (2026-04-29)**: 스크롤바 출현 시 레이아웃 흔들림(Shift) 방지를 위해 `scrollbar-gutter: stable` 적용 및 슬림 스크롤바(6px)로 최적화. 🐧✨
- **Animation Optimization (2026-04-29)**: 등장(`tween: 0.5s`)과 호버(`spring: bouncy`) 로직을 완전 분리하여 CSS 간섭 없는 즉각적인 인터랙션 구현. 🐧⚡

---
*Last Updated: 2026-04-29 (App Hub Layout Optimization)*
