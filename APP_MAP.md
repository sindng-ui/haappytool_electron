# HAPPY Tool - Application Map

## 🧩 Plugins

### [Log Analysis Agent](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/LogAnalysisAgent)
로그 분석을 자동화하는 AI 에이전트 플러그인입니다.
- **UI Components**:
  - `AgentConfigPanel`: 분석 모드, 미션 필터, 로그 소스 및 분석 실행 버튼을 포함하는 메인 설정 패널.
    - **Update (2026-04-03)**: 버튼 높이를 키워 시각적 강조 효과 부여 (`py-7`, `py-6.5` 적용).
    - **Update (2026-04-03)**: 상단 타이틀 바에 'Debug Mode' 토글 추가.
    - **Update (2026-04-03)**: 디버그 모드 시 LLM과의 원문 통신 내역(Request/Response JSON)을 확인할 수 있는 'LLM Communication' 탭 추가.
  - `AgentThoughtStream`: 에이전트의 사고 과정 및 진행 상태를 시퀀셜하게 보여주는 뷰어.
  - `FinalReportViewer`: 최종 분석 보고서를 마크다운 형식으로 렌더링.

## 🏗️ UI Components

### [Log Extractor](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogExtractor.tsx)
로그 추출 및 실시간 스트리밍 기능을 제공합니다.
- **Log Settings**: 'Start Logging' 버튼 (인디고 테마의 솔리드 버튼의 기준 디자인).

---
*Last Updated: 2026-04-03*
