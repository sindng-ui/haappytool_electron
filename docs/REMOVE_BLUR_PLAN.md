# 블러 효과 및 무거운 애니메이션 전수 제거 계획서 🚀

형님! 전수조사 결과, 앱 곳곳에 `backdrop-blur`와 무거운 애니메이션들이 산재해 있는 것을 확인했습니다. 이를 일괄 정리하여 진정한 '리눅스 개발자' 스타일의 빠릿한 앱으로 변모시키겠습니다.

## 🎯 주요 타겟
전수조사된 20여 개 이상의 파일에서 다음 요소들을 제거합니다:
1.  **Backdrop Blur**: `backdrop-blur-*` (성능에 가장 치명적)
2.  **Decorative Blur**: `blur-*` 속성을 사용한 배경 글로우 효과
3.  **Heavy Animations**: 모달 및 오버레이의 `animate-in`, `fade-in`, `puse`, `translate` 등

## 📂 작업 대상 파일 리스트 (핵심)
- `components/ui/LoadingOverlay.tsx`
- `components/Sidebar.tsx`
- `components/LogViewer/TopBar.tsx`
- `components/PerfRawViewer.tsx`
- `components/KeyboardShortcutsPanel.tsx`
- `components/LogViewer/PerfDashboard` 하위 모든 컴포넌트
- `plugins/TizenLab/TizenFileExplorer.tsx`
- 기타 모든 팝업 및 모달류

## 🛠️ 수정 원칙
- `backdrop-blur` 제거 시 배경색의 투명도를 소폭 낮추거나(`bg-black/80` 등) 불투명도를 높여 가독성을 유지합니다.
- 애니메이션 제거로 즉각적인 UI 반응을 제공합니다.

## 📝 상세 계획
1.  **Phase 1: 글로벌 UI 요소 정리** (Sidebar, TopBar, LoadingOverlay)
2.  **Phase 2: 모달 및 대화창 정리** (KeyboardShortcutsPanel, Tizen Connection 등)
3.  **Phase 3: 성능 집중 도구 정리** (PerfDashboard, PerfRawViewer, PostTool)
4.  **Phase 4: 플러그인 및 기타 요소 정리** (TizenLab, EasyUML 등)

형님, 이 계획대로 진행해도 괜찮을까요? 유저 대답으로 `진행해` 혹은 `proceed` 라고 말씀해 주시면 바로 전수 작업 들어가겠습니다!
