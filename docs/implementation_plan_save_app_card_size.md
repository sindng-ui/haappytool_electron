# 구현 계획서: 앱 허브 카드 크기 저장 기능 🐧

앱 허브(App Hub)에서 마우스 우클릭으로 변경한 카드 크기가 저장되지 않는 문제를 해결하기 위해, 해당 상태를 전역 설정(`AppSettings`)으로 편입시키고 `localStorage`에 저장하도록 개선합니다.

## 1. 개요
현재 `AppLibraryModal` 내부에만 존재하는 `pluginSizes` 상태를 `App.tsx`의 전역 설정으로 이동시켜, 앱 재시작 시에도 형님이 설정한 레이아웃이 유지되도록 합니다.

## 2. 주요 변경 사항

### 2.1 types.ts
- `AppSettings` 인터페이스에 `pluginSizes?: Record<string, 'normal' | 'wide' | 'large'>` 필드 추가.

### 2.2 App.tsx
- `pluginSizes` 상태(State) 추가.
- `useEffect` (마운트 시): `localStorage`에서 `pluginSizes` 데이터를 로드하여 상태 초기화.
- `useEffect` (상태 변경 시): `pluginSizes`가 변경될 때마다 `localStorage` 및 파일 동기화 대상에 포함.
- `AppLibraryModal` 컴포넌트 호출 시 `pluginSizes`와 `setPluginSizes`를 Props로 전달.

### 2.3 components/AppLibraryModal.tsx
- 내부 `useState<Record<string, ...>>({})` 제거.
- 부모로부터 받은 Props를 통해 카드 크기를 조회하고 변경하도록 수정.

## 3. 안정성 및 성능 고려 사항
- **리그레션 방지**: 기존에 저장된 설정 파일이 없는 경우에도 기본값(`normal`)이 정상적으로 적용되도록 폴백 처리.
- **I/O 최적화**: 기존에 구현된 1초 디바운스(Debounce) 로직을 그대로 활용하여 빈번한 쓰기 작업 방지.

## 4. 진행 순서
1. `types.ts` 수정
2. `App.tsx` 수정
3. `AppLibraryModal.tsx` 수정
4. 테스트 및 `APP_MAP.md` 업데이트

---
형님, 이대로 진행해도 괜찮을까요? 형님이 오케이 해주시면 바로 작업 들어갑니다! 🚀
