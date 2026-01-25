# 기능 구현 계획 - ST Lab 고도화 (그래프 모니터링 & 가상 장치)

## 1. 실시간 센서 그래프 (Live Monitor)
*   **파일**: `plugins/SmartThingsLab/LiveMonitor.tsx` 생성
*   **기능**:
    *   `recharts`를 사용하여 라인 차트 구현.
    *   선택된 디바이스의 Capability 중 수치형(Number) 속성 자동 감지 (온도, 습도, 레벨 등).
    *   SSE 이벤트(`device-event`) 수신 시 차트 데이터 배열에 `{ timestamp, value }` 추가.
    *   최근 50~100개 데이터 포인트 유지 (Windowing).
    *   차트 Y축 자동 스케일링 및 툴팁 제공.

## 2. 가상 장치 생성 고도화
*   **파일**: `plugins/SmartThingsLab/VirtualDeviceManager.tsx` 수정
*   **기능**:
    *   단순 이름 입력에서 **프로필(Profile) 선택** 기능 추가.
    *   사전 정의된 유용한 가상 장치 프로필 목록 제공 (예: 스위치, 디머, 온습도 센서, 모션 센서 등).
    *   생성 전 "미리보기" 아이콘 표시.

## 3. 통합 및 UI 배치
*   `SmartThingsLabPlugin.tsx`
    1.  Tab 메뉴에 `MONITOR` 추가.
    2.  `LiveMonitor` 컴포넌트 연결.
    3.  `VirtualDeviceManager` props 확장.

## 4. 상세 구현 스텝
1.  **LiveMonitor 컴포넌트 개발**: Recharts 연동 및 더미 데이터 테스트.
2.  **데이터 파이프라인 연결**: `SmartThingsLabPlugin`에서 수신한 SSE 이벤트를 `LiveMonitor`로 전달하거나, Context/Props로 공유.
3.  **VirtualDeviceManager UI 개선**: 프로필 선택 드롭다운 및 미리보기 UI 추가.
