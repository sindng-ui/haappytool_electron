# 🏗️ UI Components

> **문서 분리 기준 (Threshold)**: 하위 항목이 100줄을 초과하거나 핵심 기능 명세가 5개 이상 쌓일 경우, 이 문서에서 분리하여 개별 파일로 관리하고 링크만 남깁니다.

### [Log Extractor](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogExtractor.tsx)
로그 추출 및 실시간 스트리밍 기능을 제공합니다. *(⚠️ Note: 이 섹션은 점점 비대해지고 있으므로 향후 `LOG_EXTRACTOR.md`로 독립할 예정입니다.)*
- **Tizen Connection (2026-05-09)**: [NEW]
  - **Serial Support**: SDB, SSH 외에 **Serial(COM Port)** 직접 연결 모드 추가. 🐧🔌
  - **Auto Port Detection**: 사용 가능한 COM 포트 목록 자동 스캔.
  - **Quick Command Palette (2026-05-17)**: 플로팅 패널을 통한 빠른 명령어 전송 및 실시간 검색(Search Bar) 추가. 🐧🚀⚡
- **Bookmarks Modal Export (2026-04-10)**:
  - **Confluence Table Fix**: 마크업 생성 로직 개선.
  - **Original Line Number Support**: 원본 라인 번호 매핑 안정화.
- **Export Logic Enhancement (2026-04-10)**:
  - **Full Filtered Export**: 버튼 클릭 시 항상 필터링된 전체 로그 대상 복사.
  - **Transaction Analysis Fix**: PID/TID 정규식 오류 수정.
- **Stability Fixes & Optimizations**:
  - **Orphaned Stream GC**: 스트림 메모리 방어 로직.
  - **Build Fix (2026-05-12)**: `serialport` 네이티브 모듈 의존성 승격.
  - **Serial Shell Connectivity Fix (2026-05-13)**: 입력 및 상태 로직 강화. 🐧🛡️⚡
  - **Startup & Performance Optimization (2026-05-14)**: 백엔드 모듈 지연 로딩(5s -> 0.2s), 플러그인 즉시 로딩 적용. 🐧⚡
  - **Global Zoom Sync (2026-05-14)**: `LogViewPreferencesContext`를 통한 전 탭 줌 설정 동기화. 🐧💎⚡
  - **Log Viewer Selection Engine High-Fidelity (2026-05-15)**: `Alt` 키 기반 텍스트 선택, 스크롤 점핑 현상 등 브라우저 기본 로직과의 충돌 완벽 해결. 🐧💎⚡
  - **Global Localization (2026-05-15)**:
    - **English-First UI**: 모든 UI 영문화.
    - **Worker Logic Documentation**: 코어 워커들의 고난도 최적화 로직 100% 영문 주석화 완료.

### [SpeedScope Analyzer](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/SpeedScope/SpeedScopePlugin.tsx)
- **Unified Diff Mode v2 (2026-04-06)**:
  - **Matching Engine v2**: 정밀 매칭 엔진 및 함수별 성능 변화 집계.
  - **Layout Reconstruction**: 화면 잘림 현상을 원천 해결하는 엄격한 Flex 계층 구조 수립 (`min-h-0` 도입).

### [NetTraffic Analyzer](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/NetTrafficAnalyzer/NetTrafficAnalyzerPlugin.tsx)
- **GUI & CLI Unified Core (2026-04-07)**:
  - **AppSettings Integration**: 설정을 전역 `AppSettings`로 통합하여 CLI 연동.
  - **Strict Pattern Matching**: 사용자 정밀 추출 Regex 최우선 적용.

### [BlockTest Plugin](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/BlockTest)
Tizen 기기 테스트를 위한 블록 기반 파이프라인 엔진.
- **Reliability Update (2026-04-08)**: 
  - 타임아웃 12초 상향, `SIGKILL` 도입으로 좀비 프로세스 방지.

### [AppHub](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/AppHub.tsx) [NEW]
앱 라이브러리 및 설정을 호출하는 메인 진입점 컴포넌트입니다.
- **UI Features & Optimizations**:
  - **Static Grid System**: 안정적인 정적 그리드 레이아웃.
  - **Scrollbar Stabilization (2026-04-29)**: `scrollbar-gutter: stable` 적용. 🐧✨
  - **Animation Optimization (2026-04-29)**: 등장(`tween`)과 호버(`spring`) 애니메이션 완벽 분리 및 성능 최적화. 🐧💎⚡
  - **Card Size Persistence (2026-04-30)**: App 카드 크기 LocalStorage 영구 보존.
  - **Section Collapse Default (2026-05-01)**: Labs 섹션 기본 접힘 처리.

### [Common Dialog System](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/ui/CommonDialogs.tsx) [NEW]
- **Standardization (2026-05-15)**:
  - **Unified Interaction**: 기존 `window.confirm()` 등을 대체하는 커스텀 다이얼로그 전역 도입. 🐧💎⚡
  - **Component Suite**: `ConfirmDialog`, `PromptDialog`.

<br>

[🔼 메인 맵으로 돌아가기](../../APP_MAP.md)
