# Easy Post 가짜 데이터 로드 추가

## 작업 내용
Easy Post 플러그인의 테스트를 용이하게 하기 위해 **Load Fake Data** 기능을 추가했습니다. 실제 API 호출 없이 미리 정의된 Mock 데이터를 로드하여 UI 및 동작을 확인할 수 있습니다.

## 변경 사항
- **`plugins/EasyPost/EasyPostPlugin.tsx`** 수정:
    - **Load Fake Data** 버튼 추가 (에메랄드 색상, 기존 버튼 옆에 배치).
    - `handleLoadFakeData` 함수 구현:
        - 2개의 가상 Location (Home, Office) 생성.
        - 각 Location 별 Room 및 Device 데이터 매핑.
        - Summary 정보 포함.
        - 실제 로딩 효과를 위한 0.8초 지연 추가.

## 기능 확인
1.  Easy Post 플러그인 진입.
2.  **Load Fake Data** 버튼 클릭.
3.  "My Sweet Home", "Headquarters" Locations이 로드되는지 확인.
4.  Location 확장 및 상세 보기(Summary) 테스트.
