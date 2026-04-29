# Implementation Plan - App Hub Scrollbar Layout Shift Fix

형님, 모달 열릴 때 스크롤바 때문에 화면이 꿀렁이는 현상(Layout Shift)은 아주 거슬리는 부분이죠. 이를 해결하기 위해 스크롤바가 있든 없든 공간을 미리 확보해두는 `scrollbar-gutter` 속성을 도입하고, App Hub에 부적절하게 컸던 스크롤바 두께를 최적화하겠습니다.

## 📋 변경 사항

### 1. `index.css`

- **새로운 유틸리티 클래스 추가**
  - `.scrollbar-stable`: `scrollbar-gutter: stable` 속성을 추가하여 스크롤바의 출현과 상관없이 레이아웃 폭을 일정하게 유지합니다.

### 2. `components/AppLibraryModal.tsx`

- **스크롤바 스타일 및 레이아웃 최적화**
  - `custom-scrollbar` 제거: 로그 뷰어용으로 설계된 두꺼운(15px) 스크롤바 대신, 전역 기본값인 슬림한(6px) 스크롤바를 사용하도록 변경합니다.
  - `scrollbar-stable` 추가: 애니메이션 도중 스크롤바가 생겼다 사라져도 앱 카드들의 너비가 변하지 않도록 고정합니다.

## 🛠️ 작업 단계

1. `index.css`에 `.scrollbar-stable` 클래스 정의 추가.
2. `components/AppLibraryModal.tsx`의 클래스 명 수정.
3. `APP_MAP.md`에 레이아웃 안정화 작업 내용 업데이트.

---

형님, 이렇게 하면 그 '뿅' 하고 늘어나는 현상이 깔끔하게 사라질 겁니다. 바로 작업 시작할까요? 🐧✨
