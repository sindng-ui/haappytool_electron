# Implementation Plan: Release History Modal UI Fix

형님, 릴리즈 상세 모달이 잘리는 문제를 깔끔하게 해결하겠습니다. 모달 레이아웃 구조를 최적화하여 내용이 많아져도 버튼이 항상 보이고, 문서 영역만 부드럽게 스크롤되도록 수정하겠습니다.

## 🛠️ 변경 사항

### 1. `ReleaseDetailModal.tsx` 레이아웃 최적화
- **Container Height**: `max-h-[90vh]`를 유지하되, 내부 `flex` 구조를 강화하여 자식 요소들이 부모 높이를 넘지 않도록 `min-h-0`를 적재적소에 배치합니다.
- **Header & Footer**: 고정(shrink-0) 높이를 유지하여 상단 정보와 하단 버튼이 항상 화면 내에 위치하도록 합니다.
- **Body Content**: 
    - 상단 요약 정보 그리드와 태그 섹션을 하나의 그룹으로 묶거나, 전체적인 스크롤 전략을 재검토합니다.
    - 특히 **Internal Documentation** 영역에 `flex-1`과 `overflow-y-auto`를 확실히 적용하여, 텍스트가 길어질 경우 이 부분만 스크롤되게 만듭니다.
- **Visual Polish**: 모달이 화면 중앙에서 벗어나지 않도록 `justify-center`와 함께 `max-height`에 따른 정렬을 보정합니다.

### 2. `APP_MAP.md` 업데이트
- UI 수정 사항을 `Release History` 섹션의 `ReleaseDetailModal` 업데이트 내역에 기록합니다.

## 📅 일정
1. 레이아웃 코드 수정 및 검토
2. 결과 확인 (형님께 피드백 요청)
3. APP_MAP.md 업데이트

형님, 바로 진행할까요? `Proceed` 버튼을 눌러주시면 바로 코딩 들어갑니다!

<button>Proceed</button>
