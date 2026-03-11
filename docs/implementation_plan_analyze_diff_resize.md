# Analyze Diff UI 드래그 조정 기능 구현 계획서

형님, Analyze Diff 화면에서 상단 정보창(Summary/Timeline)과 하단 로그 영역 사이의 높이를 자유롭게 조절할 수 있도록 개선하겠습니다. 조정한 높이는 Local Storage에 저장되어 다음 번에도 유지되도록 하겠습니다. 🐧⚡

## Proposed Changes

### [Component] Log Viewer State & Types

#### [MODIFY] [types.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/types.ts)
- `LogViewPreferences` 인터페이스에 `splitAnalyzerHeight?: number` 속성을 추가합니다.

#### [MODIFY] [useLogViewPreferences.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/hooks/useLogViewPreferences.ts)
- `splitAnalyzerHeight` 상태를 추가하고, 초기값을 `localStorage` (또는 `getStoredValue`)에서 로드합니다. (기본값: 350)
- `setSplitAnalyzerHeight` 래퍼 함수를 제공하여 상태 업데이트와 동시에 `localStorage`에 저장하도록 합니다.

### [Component] UI Components

#### [MODIFY] [SplitAnalyzerPanel.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/SplitAnalyzerPanel.tsx)
- `height` prop을 추가합니다.
- `motion.div`의 `animate` 속성에서 `height`를 하드코딩된 `'40vh'` 대신 prop으로 받은 `height` 값으로 변경합니다.

#### [MODIFY] [LogSession.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogSession.tsx)
- `SplitAnalyzerPanel` 바로 아래에 드래그 가능한 `Divider` 영역을 추가합니다.
- 마우스 드래그를 감지하여 `splitAnalyzerHeight`를 실시간으로 업데이트하는 로직을 추가합니다.
- 드래그 중에는 텍스트 선택이나 다른 간섭이 없도록 조치합니다.

## Verification Plan

### Manual Verification
1. **드래그 기능 확인**: Analyze Diff를 켠 후, 상단 정보창과 로그 사이의 경계선을 잡고 위아래로 드래그하여 높이가 조절되는지 확인합니다.
2. **최소/최대 높이 제한**: 너무 작아지거나 너무 커져서 UI가 깨지지 않는지(최소 100px, 최대 화면의 80% 등) 확인합니다.
3. **영속성 확인**: 높이를 조절한 후 앱을 새로고침하거나 탭을 껐다 켰을 때 조절된 높이가 그대로 유지되는지 확인합니다.
4. **리액션 확인**: 높이 조절 시 내부의 스크롤 영역들이 자연스럽게 리사이징되는지 확인합니다.

<button id="proceed_button" style="padding: 10px 20px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">형님, 이대로 진행할까요? (Proceed)</button>
