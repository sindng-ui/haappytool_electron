# Touch Block Coordinate Picker (터치 좌표 픽커) 구현 계획

## 개요

Tizen 단말의 화면을 실시간으로 캡처하거나 이미지를 띄운 뒤,  
사용자가 마우스 클릭으로 **정확한 X, Y 터치 좌표를 시각적으로 선택/추출**할 수 있는  
**Coordinate Picker (좌표 픽커)** 모달을 `BlockTest` 플러그인의 Touch Block에 추가합니다.

---

## 주요 기능 및 UI 흐름

1. **Touch Block 노드 UI 확장**:
   - `PipelineEditor.tsx` 의 Touch Block 노드에 🎯 `Coordinate Picker` 버튼 (십자선/카메라 아이콘) 추가
2. **Coordinate Picker 모달 (`CoordinatePickerModal.tsx`)**:
   - **📸 Capture Device Screen**: SDB 연결된 Tizen 단말 화면 캡처 (`capture_screen` socket event)
   - **📋 Paste / Upload Image**: 로컬 이미지 업로드 또는 클립보드 이미지 붙여넣기 지원
   - **🎯 Visual Canvas Crosshair**: 캡처 이미지 위로 마우스를 올리면 십자선 커서와 실시간 `(X, Y)` 좌표 툴팁 안내
   - **🔍 Real-size Ratio Calculation**: 렌더링된 캔버스/이미지 크기와 실제 이미지 원본 해상도(`naturalWidth`, `naturalHeight`)의 비율을 계산하여 **정확한 실제 화면 좌표** 추출
   - **✅ Apply Coordinates**: 클릭하여 선택한 X, Y 좌표를 해당 Touch Block의 `touchX`, `touchY`에 즉시 반영
3. **App Map 업데이트**: `APP_MAP.md`에 Coordinate Picker 기능 사양 기록

---

## 변경 및 신규 파일 목록

### 1. `CoordinatePickerModal.tsx` [NEW]
- **위치**: `components/BlockTest/components/CoordinatePickerModal.tsx`
- **역할**:
  - 캡처 이미지 시각화 및 좌표 선택 팝업 UI (글래스모피즘 & 60fps 최적화)
  - 캡처 요청, 좌표 계산, 미리보기 돋보기/십자선 렌더링, 픽처 적용 콜백

### 2. `PipelineEditor.tsx` [MODIFY]
- **위치**: `components/BlockTest/components/PipelineEditor.tsx`
- **역할**:
  - Touch Block 노드에 🎯 **Picker 버튼** 추가
  - 모달 렌더링 상태(`activePickerItem`) 관리 및 `CoordinatePickerModal` 마운트

### 3. `useBlockTest.ts` [MODIFY]
- **위치**: `components/BlockTest/hooks/useBlockTest.ts`
- **역할**:
  - 단말 화면 캡처 훅 메서드 `captureScreen(deviceId?: string): Promise<{ success: boolean, url?: string, message?: string }>` 추가

---

## 구현 세부 내용

### 1. 비율 기반 정밀 좌표 계산 로직
```typescript
const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();
    
    // 클릭된 표시 상의 상대 위치 (0 ~ rect.width / rect.height)
    const displayX = e.clientX - rect.left;
    const displayY = e.clientY - rect.top;
    
    // 실제 원본 이미지 해상도 비율로 환산
    const scaleX = img.naturalWidth / rect.width;
    const scaleY = img.naturalHeight / rect.height;
    
    const realX = Math.round(displayX * scaleX);
    const realY = Math.round(displayY * scaleY);
    
    setSelectedCoords({ x: realX, y: realY });
};
```

### 2. SDB 화면 캡처 연동
- 백엔드(`server/index.cjs`)에 내장된 `capture_screen` 이벤트를 호출하여 Tizen 단말 캡처 이미지 URL(`/captures/screen_xxx.png`) 수신
- 이미지가 픽커 모달에 로드되면 즉시 좌표 지정 준비 완료!

---

## 검증 계획

1. 파이프라인 캔버스에서 Touch Block의 🎯 좌표 픽커 버튼 클릭 시 모달 오픈 확인
2. SDB 단말 연결 상태에서 `Capture Device Screen` 클릭 시 화면이 픽커에 노출되는지 확인
3. 캡처 이미지 위에 마우스를 얹었을 때 십자선 커서 및 실시간 X/Y 좌표 툴팁이 렉 없이 따라다니는지 확인
4. 원하는 위치 클릭 시 선택 좌표가 고정되고, `Apply` 적용 시 Touch Block의 `x`, `y` 인풋에 정확히 들어가는지 확인
5. 저장 후 파이프라인 실행 시 픽킹한 좌표로 `sdb shell input tap (X) (Y)` 명령이 전송되는지 확인

---

## User Review Required

> [!IMPORTANT]
> **형님, 계획서를 검토해 주시고 승인(Proceed)해 주시면 바로 픽커 개발에 착수하겠습니다!** 🐧🚀
