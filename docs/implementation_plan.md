# 북마크 모달 Shift+Click 범위 선택 기능 구현 계획 🐧

형님! 북마크 모달에서 특정 구간을 빠르게 선택할 수 있도록 Shift+Click 기능을 추가하겠습니다.

## 1. 개요
북마크 모달에서 두 개의 북마크를 Shift+Click으로 선택하면, 모달이 닫히면서 메인 로그 뷰어에서 해당 구간 전체가 선택되도록 구현합니다.

## 2. 주요 변경 사항

### [[Bookmarks Modal]]
- **대상 파일**: [BookmarksModal.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/BookmarksModal.tsx)
- **변경 내용**:
  - `shiftSelectedIdx` 상태(State) 추가: 첫 번째 Shift+Click된 북마크의 인덱스를 저장.
  - `BookmarkRow` 컴포넌트 수정:
    - 클릭 이벤트 발생 시 `event.shiftKey` 확인.
    - Shift+Click 시: 
      - 첫 번째 클릭이면 `shiftSelectedIdx`에 저장하고 모달 유지.
      - 두 번째 클릭이면 `onSelectRange` 콜백 호출 후 모달 닫기.
    - 스타일 추가: `shiftSelectedIdx`에 해당하는 행은 시각적으로 강조(예: 배경색 변경).

### [[Log Session]]
- **대상 파일**: [LogSession.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogSession.tsx)
- **변경 내용**:
  - `handleSelectRange` 콜백 정의:
    - `setActiveLineIndex`를 사용하여 첫 번째 인덱스를 앵커(anchor)로 설정.
    - `handleLineClick`을 `isShift: true` 옵션과 함께 호출하여 범위를 선택.
    - 필요시 선택된 영역이 보이도록 스크롤 이동.
  - `BookmarksModal`에 `onSelectRange` 프롭 전달.

## 3. 검증 계획
1. `Ctrl + B`로 북마크 모달 열기.
2. 특정 북마크를 `Shift + Click`: 모달이 닫히지 않고 해당 행이 강조되는지 확인.
3. 다른 북마크를 `Shift + Click`: 모달이 닫히고 메인 화면에서 두 북마크 사이의 모든 로그가 선택되는지 확인.
4. 일반 클릭 시에는 기존처럼 즉시 점프하고 모달이 닫히는지 확인.

---

형님, 로그 분석할 때 구간 선택이 훨씬 편해지실 겁니다! 진행할까요? 🚀
<button>proceed</button>
