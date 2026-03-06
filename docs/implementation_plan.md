# 로그 상세 보기(Raw View) 닫기 버튼 오동작 수정 계획서 🐧🛠️

형님, 로그 상세 보기 창에서 X 버튼인 닫기 버튼이 클릭되지 않는 문제를 해결하고, 관련 코드를 정리하기 위한 계획입니다.

## 문제 현상
*   로그 상세 보기(Raw View)의 우측 상단 'X' 버튼이 클릭되지 않음.
*   `LogSession.tsx` 내부에 `RawContextViewer` 컴포넌트가 중복 정의되어 있어 유지보수가 어려움.

## 원인 분석
1.  **Z-Index 및 DOM 순서 문제**: `RawContextViewer`가 DOM 상에서 툴바보다 앞에 위치하거나 `z-index`가 충분하지 않아 클릭이 가로막힐 가능성이 여전히 존재합니다.
2.  **클릭 영역 협소**: 버튼 크기(`size={14}`)가 작아 정확한 클릭이 어려울 수 있습니다.

## 제안하는 변경 사항

### [Component] RawContextViewer
*   `components/LogViewer/RawContextViewer.tsx` 수정
    *   최상단 컨테이너의 `z-index`를 `z-[70]`에서 `z-[1000]`으로 대폭 상향합니다.
    *   닫기 버튼에 `p-2` 패딩과 `cursor-pointer`를 추가하여 클릭 영역을 넓히고 피드백을 강화합니다.
    *   이벤트 도달 확인을 위한 `console.log`를 추가합니다.

### [Component] LogSession
*   `components/LogSession.tsx` 수정
    *   `RawContextViewer` 렌더링 위치를 DOM의 가장 마지막(닫는 `div` 직전)으로 이동시켜 자연스러운 쌓임 순서(Stacking Order)에서도 가장 위에 오게 합니다.

## 검증 계획
### 수동 검증
1.  로그 추출기(Log Extractor)에서 로그 라인을 더블 클릭하여 Raw View를 띄웁니다.
2.  우측 상단의 'X' 버튼이 정상적으로 클릭되고 창이 닫히는지 확인합니다.
3.  창의 리사이즈 핸들(하단)이 정상적으로 작동하는지 확인합니다.
4.  창 내부의 로그 뷰어(`LogViewerPane`)가 정상적으로 스크롤되고 내용을 보여주는지 확인합니다.

---
형님, 이 계획대로 진행해도 될까요? OK 하시면 바로 작업 시작하겠습니다! 🚀

<button>Proceed</button>
