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
- **UI Components**:
  - `ReleaseHistoryPlugin`: 듀얼 뷰 모드(List/Timeline).
  - `ListView`: 릴리즈 버전 아코디언형 리스트.
  - `TimelineGraphView`: 시각화된 2D 타임라인 뷰.
  - `ReleaseDetailModal` & `AddReleaseModal`: 마크다운 지원 모달.
- **Features**:
  - **Tag System**: `Hotfix`, `Feature`, `Major` 등 프리셋 태그 지원.

### [Plugin Visibility Management](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/config.ts) [NEW]
- **Management Logic (2026-04-10)**:
  - **Comprehensive Toggle**: 14종의 실험실 플러그인 개별 가시성 플래그 제공.
  - **Registry Filtering**: 필터링 수행.

<br>

[🔼 메인 맵으로 돌아가기](../../APP_MAP.md)
