# 북마크 모달 누적 시간 표시 구현 계획 🐧

형님! 북마크 모달에서 각 북마크 간의 시간 차이뿐만 아니라, 첫 번째 북마크를 기준으로 한 **누적 시간(Accumulated Time)**을 볼 수 있도록 기능을 추가하겠습니다.

## 1. 개요
현재 북마크 모달은 인접한 북마크 간의 시간차만 보여주고 있습니다. 분석의 흐름을 더 잘 파악하기 위해, 첫 번째로 지정한 북마크 시점으로부터 얼마나 시간이 흘렀는지 표시하는 열을 추가합니다.

## 2. 주요 변경 사항

### [[Bookmarks Modal]]
- **대상 파일**: [BookmarksModal.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/BookmarksModal.tsx)
- **변경 내용**:
  - `BookmarkLine` 인터페이스에 `accumulatedTimeStr`, `accumulatedTimeClass` 필드 추가.
  - 데이터 로딩(`useEffect`) 시 첫 번째 북마크의 타임스탬프를 `firstTs`로 저장.
  - 각 북마크마다 `currentTs - firstTs`를 계산하여 누적 시간 포맷팅.
  - **UI 레이아웃 변경**:
    - 기존 'Time Diff' 열 옆에 'Accumulated' 열 추가.
    - `BookmarkRow` 컴포넌트에 누적 시간 표시 영역 추가.
    - 헤더 영역에 컬럼 타이틀 추가.

### [[Export 기능]] (옵션)
- JSON/Confluence Export 시에도 누적 시간 정보가 포함되도록 수정할지 검토 (형님 의견에 따라 추가 가능).

## 3. 검증 계획
- 북마크를 여러 개 추가한 후 `Ctrl + B`로 모달을 열어 첫 번째 행은 `0.000s`, 이후 행들은 누적된 시간이 정상적으로 표시되는지 확인.
- 북마크 삭제 시 누적 시간이 재계산되어야 하는지 확인 (현재 로직상 모달 열릴 때마다 재계산되므로 정상 동작 예상).

---

형님, 분석용으로 아주 유용한 기능이 될 것 같습니다! 이대로 진행할까요? 🚀
<button>proceed</button>
