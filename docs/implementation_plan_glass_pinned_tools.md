# Implementation Plan - App Hub Pinned Tools 유리 질감 효과 적용 💎

형님! 고정된 앱(Pinned Tools)들을 더 돋보이게 하기 위해 과하지 않고 고급스러운 **유리 질감(Glassmorphism)** 효과를 적용해 보겠습니다. 🐧✨

## 1. 개요
현재 모든 앱 카드가 동일한 불투명도를 가지고 있습니다. "Pinned Tools" 섹션의 앱들에만 은은한 백그라운드 블러와 투명도를 적용하여 하단 "Labs" 섹션과 시각적으로 차별화된 프리미엄 느낌을 부여합니다.

## 2. 변경 사항

### [[App Library UI 강화]]
- **대상 파일**: `components/AppLibraryModal.tsx`
- **수정 내용**: 
  - `AppCard` 컴포넌트에 `isGlassy` 프롭 추가.
  - "Pinned Tools" 섹션에서 `AppCard` 호출 시 `isGlassy={true}` 전달.
  - "Labs" 섹션에서는 기존 스타일 유지 (`isGlassy={false}`).
  - `isGlassy`가 true일 때 적용할 스타일:
    - `backdrop-blur-xl`: 배경을 우아하게 흐림 처리.
    - `bg-white/10`: 미세한 흰색 투명도 부여.
    - `border-white/20`: 빛을 머금은 듯한 얇은 테두리.
    - `shadow-xl`: 입체감을 위한 그림자 추가.

### [[APP_MAP 업데이트]]
- **대상 파일**: `important/APP_MAP.md`
- **수정 내용**: 
  - Section 1.3의 Features에 'Pinned Tools Glassmorphism' 내용 추가.

## 3. 작업 절차
1. `components/AppLibraryModal.tsx` 수정 (프롭 추가 및 스타일 적용)
2. `important/APP_MAP.md` 업데이트
3. 브라우저/일렉트론에서 시각적 완성도 확인

형님, 유리알처럼 영롱하게 바로 꾸며볼까요? 🐧🛡️

<button>proceed</button>
