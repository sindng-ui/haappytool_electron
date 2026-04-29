# Implementation Plan - App Hub Entry Point Dot Color Change

형님, App Hub 진입점의 깜박이는 점(Dot) 색상을 핑크에서 에메랄드(그린)로 변경하겠습니다. 현재는 별도의 상황에 따라 색상이 변하는 로직은 없어서, 형님 말씀대로 깔끔하게 녹색 계열로 바꿔두겠습니다. 🐧✨

## 📋 변경 사항

### 1. `components/AppHub.tsx`

- **깜박이는 점 (Blinking Dot)**
  - `bg-pink-500` -> `bg-emerald-500`: 색상을 녹색(에메랄드)으로 변경합니다.
  - `shadow-[0_0_8px_rgba(236,72,153,0.5)]` -> `shadow-[0_0_8px_rgba(16,185,129,0.5)]`: 그림자 색상도 에메랄드 톤에 맞춰 동기화합니다.

## 🛠️ 작업 단계

1. `components/AppHub.tsx` 파일 수정.
2. `APP_MAP.md` 파일에 변경 사항 업데이트.

---

형님, 바로 진행할까요? `proceed`라고 말씀해 주세요! 🚀
