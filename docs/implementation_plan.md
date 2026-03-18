# 상세 정보창 통계 테이블 높이 최적화 계획 🛠️📊

형님! 캡쳐해주신 화면을 보니 왼쪽 통계 영역 아래쪽에 여백이 남아서 보기에 좀 허전했네요. 이 영역을 아래쪽까지 꽉 채워서 더 꽉 찬 느낌의 UI를 만들겠습니다.

## Proposed Changes

### [Speedscope Plugin]

#### [MODIFY] [PerfSegmentDetail.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/PerfDashboard/PerfSegmentDetail.tsx)
- 통계 `table`(Line 66)에 `h-full`을 추가하여 부모인 180px 높이를 모두 차지하게 합니다.
- 데이터 행(`tr`, Line 74)에 `h-full`을 추가하여 셀(`td`)들이 높이를 나눠 갖도록 합니다.
- 각 셀(`td`, Line 75, 95) 내부의 콘텐츠를 `flex flex-col h-full`로 감쌉니다.
- 하단 바 차트 영역(Line 84, 104)의 `flex-1`이 동작하면서 남은 수직 공간을 모두 채우도록 유도합니다.

---

## Verification Plan

### Manual Verification
1. 세그먼트 클릭하여 상세 정보창 표시.
2. 왼쪽 통계 테이블의 테두리와 배경색이 **하단 경계선까지 딱 붙어 있는지** 확인 (캡쳐에서 보이던 빈 공간 제거 확인).
3. 바 차트 영역이 이전보다 길어지면서 전체적으로 균형 잡힌 모습인지 확인.

---

## [Proceed]
[형님, 이 레이아웃도 시원하게 꽉 채워버릴까요? 승인해주시면 바로 작업 들어갑니다!]
