# 🧩 Plugins

> **문서 분리 기준 (Threshold)**: 하위 항목이 100줄을 초과하거나 핵심 기능 명세가 5개 이상 쌓일 경우, 이 문서에서 분리하여 개별 파일로 관리하고 링크만 남깁니다.

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
  - 검색 결과 유사도(`distance`)를 별점(Star Rating) 시각화.
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
  - **Build Fix**: Worker 빌드 시 `jszip` bare import 해석 실패 문제를 해결하기 위해, Worker 및 관련 유틸에서 standalone UMD 번들(`jszip/dist/jszip.js`)을 직접 import하도록 변경.
- **Bug Fixes (2026-04-20 & 2026-04-22)**:
  - **Extension Fix**: `Step5_FinalDownload.tsx` — 정상적인 `.nupkg` 저장 보장.
  - **Memory Leak Fix (2026-04-22)**: 무한 루프 방어.
  - **Startup Perf Fix (2026-04-22)**: Native ESM Worker 방식으로 전환.
  - **Global Build Fix (2026-04-27)**: Global Alias 도입. 🐧⚡
- **New Features (2026-04-20)**:
  - **ISMS URL Integration**: 서명 작업을 위한 ISMS URL 입력창 및 브라우저 열기 연동.
  - **ISMS Auto Sign (Phase 2)**: 가상 브라우저 제어를 통한 자동 서명 기능.

### [Release History](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/ReleaseHistory/ReleaseHistoryPlugin.tsx) [NEW]
앱 릴리즈 버전을 제품별/릴리즈별로 타임라인과 리스트 형태로 관리하는 도구입니다.
- **UI Components & Hooks**:
  - `ReleaseHistoryPlugin`: 듀얼 뷰 모드(List/Timeline)의 컨트롤러 컴포넌트.
  - `DivisionSelector` ([DivisionSelector.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/ReleaseHistory/components/DivisionSelector.tsx)): Division을 추가, 삭제, 전환할 수 있는 프리미엄 글래스모피즘 드롭다운 UI. [NEW]
  - `useReleaseHistoryDivisions` ([useReleaseHistoryDivisions.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/ReleaseHistory/hooks/useReleaseHistoryDivisions.ts)): 다중 Division의 마이그레이션, 상태 변경, 조회 등을 전담 캡슐화한 커스텀 훅. [NEW]
  - `ListView`: 릴리즈 버전 아코디언형 리스트.
  - `TimelineGraphView`: 시각화된 2D 타임라인 뷰.
  - `ReleaseDetailModal` & `AddReleaseModal`: 마크다운 지원 모달.
- **Features**:
  - **다중 Division 관리**: 여러 개의 Division별로 릴리즈 리스트를 완벽하게 격리하여 관리하는 기능. [NEW]
  - **자동 하위 호환 마이그레이션**: 기존의 단일 세트 데이터 포맷 로드 시, `"Default"` 디비전의 데이터로 자동 변환하여 보존. [NEW]
  - **Tag System**: `Hotfix`, `Feature`, `Major` 등 프리셋 태그 지원.

### [SmartThings Presentation Dictionary](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/STPresentationDictionary) [NEW]
삼성 및 외부 업체의 다양한 SmartThings Device Presentation JSON 스키마를 수집, 분류, 검색하고 모바일 시뮬레이터로 가상 동작을 수행해볼 수 있는 프리미엄 사전 플러그인입니다.
- **UI Components**:
  - `STPresentationDictionary` ([index.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/STPresentationDictionary/index.tsx)): 메인 뷰 컴포넌트.
    - **Header Clearance**: 플로팅 아이콘 및 좌측 사이드바와의 겹침 방지를 위해 `pl-16` 헤더 규격 및 최소화/최대화 버튼 간섭 방지를 위한 왼쪽 배치 정렬 적용.
    - **Aesthetic Refinement**: 고대비 다크 모드에 어우러지는 네이비/인디고 Harmonious Palette 기반의 2-Column Bento Grid 레이아웃.
    - **UI Polish (2026-05-19)**: 돋보기 아이콘의 보더 침범 현상을 방지하도록 X축 좌표를 안쪽(`left: '1rem'`)으로 배치 보정하고, 겹침 방지 패딩 (`paddingLeft: '2.75rem'`) 및 네이티브 드롭다운 화이트아웃 방지를 위한 다크 스키마 강제 (`colorScheme: 'dark'`)를 완비.
  - `STAppPreview` ([STAppPreview.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/STPresentationDictionary/components/STAppPreview.tsx)): 대시보드 카드 타일 및 상세 슬라이더/스위치/토글 등 가상 인터랙션 모바일 뷰어 제공.
  - `PresentationDetail` ([PresentationDetail.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/STPresentationDictionary/components/PresentationDetail.tsx)): JSON의 capabilities, states, actions, routine 스펙을 자동 파싱하여 다크모드 전용 하이콘트라스트 메트릭으로 분석 및 Raw JSON 뷰어 제공.
  - `CategoryFilter` ([CategoryFilter.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/STPresentationDictionary/components/CategoryFilter.tsx)): 복수 선택 필터 및 실시간 카테고리 추가/삭제/수정(CRUD) 관리 모듈.
    - **UI Polish (2026-05-19)**: 자글자글한 하얀 외곽 실선 테두리들을 전면 걷어내고, 깊이감 있는 슬레이트 블루(`bg-slate-950/80`)와 인디고 솔리드 배경을 조합한 깔끔한 고급 다크 칩 테마 도입.
  - `ImportDialog` ([ImportDialog.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/STPresentationDictionary/components/ImportDialog.tsx)): JSON 드래그 앤 드롭 업로드 및 클립보드 원클릭 붙여넣기 폼.
- **Backend & DB Integration (2026-05-18)**:
  - `STPresentationService` ([stPresentationService.js](file:///k:/Antigravity_Projects/gitbase/happytool_electron/services/stPresentationService.js)): 로컬 로우 레벨 파일 데이터베이스(Lowdb 기반) 연동 및 JSON 검색/분류 관리 서비스.
  - **Clipboard Sniffer**: 메인 앱 포커스 혹은 3초 디바운스로 클립보드 내 ST JSON 데이터 유무를 백그라운드 스니핑하여 가져오기 배너(Banner) 알림 연동.
- **Aesthetic & Localization Standards**:
  - 100% 영문(English) 기반 UI 번역 완비 및 윈도우 컨트롤 겹침 간섭 전면 회피 완료.

### [Plugin Visibility Management](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/config.ts) [NEW]
- **Management Logic (2026-04-10)**:
  - **Comprehensive Toggle**: 14종의 실험실 플러그인 개별 가시성 플래그 제공.
  - **Registry Filtering**: 필터링 수행.

<br>

[🔼 메인 맵으로 돌아가기](../../APP_MAP.md)
