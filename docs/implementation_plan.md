# 콜스택 정보창 좌우 스크롤 추가 계획 🛠️📜

형님! 하단 정보창에서 콜스택 이름이 길면 뒷부분이 `...`으로 잘려서 보이지 않는 답답함을 해결하겠습니다. 좌우 스크롤을 지원하도록 레이아웃을 보강하겠습니다.

## Proposed Changes

### [Speedscope Plugin]

#### [MODIFY] [PerfSegmentDetail.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/PerfDashboard/PerfSegmentDetail.tsx)
- 콜스택 리스트 컨테이너(Line 136)의 `overflow-y-auto`를 `overflow-auto`로 변경하여 가로 스크롤도 허용합니다.
- 개별 아이템(Line 140)에 `w-full` 대신 콘텐츠 크기에 맞게 늘어나도록 `min-w-fit` 또는 `w-max` 속성을 부여합니다.
- 함수명 텍스트(Line 147)에서 `truncate` 속성을 제거하고 `whitespace-nowrap`을 적용하여 줄바꿈 없이 길게 표시되도록 합니다.

---

## Verification Plan

### Manual Verification
1. 매우 긴 이름의 함수를 포함한 로그 로드.
2. 해당 세그먼트 클릭하여 하단 정보창 표시.
3. 콜스택 영역에 **가로 스크롤바가 생기는지** 확인하고, 끝까지 스크롤해서 전체 이름을 볼 수 있는지 확인.
4. 기존의 세로 스크롤 동작과 'SELECTED' 배지 표시가 깨지지 않는지 확인.

---

## [Proceed]
[형님, 이 내용대로 바로 고고할까요?]
