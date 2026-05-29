# 📋 Log Extractor 클립보드 붙여넣기 기능 구현 계획서 🐧🚀

형님! 새로 요청하신 **"빈 탭에 클립보드 내용 붙여넣고 로그 분석하기"** 기능을 완벽하고 Premium한 감각으로 설계해 왔습니다. 
이 기능을 탑재하면 파일 드래그나 연결 없이도, 단 1초 만에 클립보드 로그를 복사-붙여넣어 해피 콤보 필터링과 WASM 초고속 검색 혜택을 100% 누리실 수 있습니다!

---

## 🎯 기능 명세 (To-Be Spec)

1. **클립보드 붙여넣기(Paste Clipboard) 프리미엄 버튼 탑재**
   - 파일이 열리지 않은 빈 탭(`LogViewerEmptyState.tsx`) 중앙에 은은한 Glassmorphism 스타일의 **"Paste from Clipboard"** 버튼을 탑재합니다.
   - Lucide `Clipboard` 아이콘과 hover 시 은은한 Indigo Aura 효과를 주어 앱의 프리미엄 감성을 그대로 유지합니다.
   - **[중요 - 무결성 보장]** 기존의 **"Drop a log file here or click to browse"** 파일 드래그 앤 드롭 및 탐색창 열기 동작은 단 1%의 영향도 받지 않으며, 기존 방식 그대로 100% 정상 작동합니다.
2. **스마트 핫키 `Ctrl + V` 연동**
   - 마우스로 버튼을 클릭하지 않아도, 빈 탭이 활성화된 상태에서 아무 곳에서나 **`Ctrl + V`** (또는 Mac의 경우 `Cmd + V`) 단축키를 입력하면 즉시 클립보드 데이터를 읽어와서 자동으로 로딩을 시작합니다.
3. **가짜 파일 정보(Virtual File) 자동 생성**
   - 로딩 시 타이틀 및 가상 파일 이름을 `[Clipboard] 2026-05-29 13-30.log` 처럼 **현재 년-월-일 시-분** 정보가 포함된 고유한 가독성 높은 이름으로 자동 빌드하여 탭 이름을 꾸며줍니다.
4. **WASM Core Engine & 60fps 필터 완벽 상속**
   - 클립보드로 붙여넣은 텍스트는 내부적으로 `Blob`과 `File` 객체로 자동 감싸지기 때문에, 기존의 Rust-WASM 초고속 멀티스레드 필터링, 해피콤보, 패밀리콤보, 블록리스트, 스팸 분석기 및 하이퍼 캔버스 렌더러가 단 1줄의 리그레션 없이 **100% 완벽하게 호환 작동**합니다!

---

## 🛠️ Proposed Changes (변경 예정 파일)

### 1. [MODIFY] `hooks/useLogExtractorLogic.tsx` (file:///k:/Antigravity_Projects/gitbase/happytool_electron/hooks/useLogExtractorLogic.tsx)
- `handlePasteClipboard` 기능을 구현하여 클립보드에서 텍스트를 비동기로 스캔(`navigator.clipboard.readText()`)하고, `[Clipboard] YYYY-MM-DD HH-mm.log` 형태의 `File` 객체로 포장하여 `handleLeftFileChange` 또는 `handleRightFileChange`로 주입합니다.
- `LogContext`를 통해 해당 메서드를 전역 context에 제공합니다.

### 2. [MODIFY] `components/LogSession.tsx` (file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogSession.tsx)
- `handleGlobalKeyDown` 단축키 감지 루프에 `Ctrl+V` 입력을 추가합니다.
- 현재 탭의 Active Pane이 비어있는 상태일 때(`!leftFileName`/`!rightFileName`), `handlePasteClipboard`를 즉시 트리거하여 즉각적인 로딩을 완성합니다.
- `LogViewerPane` 컴포넌트에 `onPasteClipboard` 콜백을 바인딩하여 하위 컴포넌트로 전달합니다.

### 3. [MODIFY] `components/LogViewer/LogViewerPane.tsx` (file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/LogViewerPane.tsx)
- `LogViewerPaneProps` 인터페이스에 `onPasteClipboard?: () => void` 콜백을 추가하고, 이를 `LogViewerEmptyState`로 안전하게 관통 전달합니다.

### 4. [MODIFY] `components/LogViewer/LogViewerEmptyState.tsx` (file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/LogViewerEmptyState.tsx)
- `LogViewerEmptyStateProps`에 `onPasteClipboard`를 추가합니다.
- 파일이 로드되지 않은 상태일 때, 기존 "or click to browse" 텍스트 밑에 **"Paste from Clipboard"**를 수행할 수 있는 프리미엄 버튼 영역을 고급스럽게 디자인하여 배치합니다.

---

## 🧪 검증 계획 (Verification Plan)

### 수동 검증 시나리오
1. **클립보드 데이터 복사**: 다른 메모장 등에서 테스트 로그 데이터(예: 여러 줄의 텍스트)를 드래그하여 복사(`Ctrl+C`)합니다.
2. **빈 탭 열기**: `Ctrl+T`를 누르거나 `+` 버튼을 클릭하여 "New Log" 빈 탭을 엽니다.
3. **단축키 붙여넣기**: 빈 화면에서 `Ctrl+V`를 입력합니다. 즉시 `[Clipboard] YYYY-MM-DD HH-mm.log` 파일명으로 로드되며, HyperLogRenderer에 로그 텍스트가 정확히 출력되는지 확인합니다.
4. **버튼 붙여넣기**: 또 다른 빈 탭을 만든 후, 화면의 "Paste from Clipboard" 버튼을 직접 마우스로 클릭하여 동일하게 로드되는지 검증합니다.
5. **기능 호환성 검증**: 붙여넣은 탭 상태에서 단어를 입력하여 'Happy Combo' 필터링, 'Find (Ctrl+F)' 고속 검색, 더블 클릭 Context Menu(Save Selection to Archive)가 오동작이나 멈춤(Jank) 없이 매끄럽게 돌아가는지 확인합니다.

---

형님! 이 완벽한 계획에 동의하시면 아래 **Proceed** 버튼을 클릭하시거나 승인 메시지를 편하게 남겨주십시오! 승인하시는 대로 WSL Bash를 타고 바람처럼 신나게 달려가 코드를 완벽하게 완성하겠습니다! 🐧🥊🏆
