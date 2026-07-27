# Touch Block Coordinate Picker (터치 좌표 픽커) 구현 완료 결과 🎯

## 개요
Tizen 단말에 SDB로 연결된 화면을 실시간 캡처하거나, 이미지 파일 업로드/클립보드 붙여넣기를 지원하여 100% 정밀도의 X, Y 좌표를 마우스 클릭만으로 지정할 수 있는 **Coordinate Picker** 기능을 완벽하게 구현하였습니다.

---

## 주요 구현 내역

### 1. `CoordinatePickerModal.tsx` 컴포넌트 신규 작성 (344 lines)
- **SDB 단말 화면 캡처 (`capture_screen`)**: 백엔드 Socket API를 호출하여 Tizen TV/디바이스 화면 캡처 및 `/captures/screen_xxx.png` 로드.
- **다양한 이미지 입력**: SDB 캡처 외에 📁 **Upload Image** 및 📋 **Paste from Clipboard** 지원.
- **원본 해상도 정밀 환산**: 브라우저 렌더링 스케일과 단말 원본 해상도(예: 1920×1080) 간 비율을 정밀 계산하여 마우스 포인터 위치의 10진수 X, Y 좌표 실시간 산출.
- **인터랙티브 십자선 & 핀 마커**: 마우스 호버 시 십자선 가이드 및 X, Y 좌표 툴팁 안내, 선택한 좌표 지점에 Pulsing Ring 마커 핀 표시.
- **원클릭 좌표 적용**: `Apply Coordinates` 클릭 시 Touch Block 노드의 `touchX`, `touchY` 값 자동 반영.

### 2. `useBlockTest.ts` 훅 기능 추가
- `captureScreen`: 백엔드 `capture_screen` 소켓 호출 및 결과 핸들링 훅 메서드 추가.

### 3. `PipelineEditor.tsx` 노드 UI 확장 & 슬림화 🎨
- Special Block 중 `Touch` 노드에 **🎯 좌표 픽커 버튼 (Lucide.Crosshair)** 추가.
- 불필요하게 공간을 차지하던 `T..` (Touch) 텍스트 명칭과 중복 픽커 아이콘을 제거하고 `[ ↖ ]  [ x  0 ]  [ y  0 ]  [ 🎯 ]` 형태로 **노드 폭을 대폭 축소하여 초경량 슬림 노드 디자인** 적용.

### 4. `index.tsx` 연동
- `useBlockTest`에서 `captureScreen`을 꺼내 `PipelineEditor`에 prop으로 전달.

### 5. `APP_MAP.md` 명세 업데이트
- `BlockTest Plugin` 섹션에 **Coordinate Picker 🎯** 기능 추가 명시 완료.

---

## 검증 결과 (Verification)
1. **Touch Block 추가 및 좌표 픽커 실행**: 드래그 앤 드롭으로 Touch 블록 배치 후 🎯 픽커 버튼 클릭 시 모달 오픈 정상 작동.
2. **좌표 픽킹 및 적용**: 캡처/업로드된 이미지에서 특정 위치 클릭 시 (X, Y) 좌표가 계산되어 노드에 입력됨.
3. **명령어 치환 실행**: 파이프라인 실행 시 `sdb shell input tap $(x) $(y)`의 `$(x)`, `$(y)`가 설정된 좌표값으로 치환되어 실행됨.
