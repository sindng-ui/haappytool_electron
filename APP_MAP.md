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

## 🏗️ UI Components

### [Log Extractor](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogExtractor.tsx)
로그 추출 및 실시간 스트리밍 기능을 제공합니다.
- **Log Settings**: 'Start Logging' 버튼 (인디고 테마의 솔리드 버튼의 기준 디자인).
- **Interactions**: `Alt + Mouse Double Click` 시 하이라이트 토글, `Alt + Mouse Right Click` 시 모든 퀵 하이라이트 일괄 해제 기능 구현.

### [SpeedScope Analyzer](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/SpeedScope/SpeedScopePlugin.tsx)
- **Unified Diff Mode v2 (2026-04-06)**: 두 프로파일의 성능 차이를 직관적으로 분석하는 고도화된 비교 모드.
  - **Matching Engine v2**: `utils/performanceDiff.ts` — Greedy best-match + position-ratio 기반 정밀 매칭. Removed 세그먼트 추적.
  - **FunctionDiffStat**: 함수별 totalTime/selfTime/callCount 집계 및 regressed/improved/added/removed 분류.
  - **PerfFlameDiff v2**: `components/SpeedScope/PerfFlameDiff.tsx` — rAF 렌더 루프, 마우스 휠 줌, 드래그 팬, 호버 툴팁, ResizeObserver.
  - **PerfFlameDiffRenderer v2**: `components/SpeedScope/utils/PerfFlameDiffRenderer.ts` — 타임라인 축 라벨, removed ghost 렌더링, delta 포함 텍스트.
  - **DiffStatsPanel**: `components/SpeedScope/DiffStatsPanel.tsx` [NEW] — 함수별 종합 비교 테이블 (정렬/필터/검색, 글로벌 요약, 하이라이트 연동).
  - **Layout**: FlameGraph(상 55%) + DiffStatsPanel(하 45%) 분할, 드래그 리사이즈 가능. 양방향 하이라이트 연동.
  - **기존 싱글 뷰**: 전혀 변경 없음.

---
*Last Updated: 2026-04-06 (SpeedScope Unified Diff v2 고도화)*
