# Implementation Plan - App Hub Modal Position Adjustment

## 1. 개요
현재 `App Hub` 버튼을 눌렀을 때 나타나는 `AppLibraryModal`이 화면 중앙에 고정되어 있어, 마우스 이동 거리가 깁니다. 이를 버튼이 위치한 왼쪽 상단 근처로 이동시켜 사용성을 개선합니다.

## 2. 변경 사항

### 2.1 `components/AppLibraryModal.tsx` 수정
- **레이아웃 정렬 변경**: 
    - 부모 `div`의 `items-center justify-center`를 `items-start justify-start`로 변경합니다.
    - `p-8`을 `pt-20 pl-4 pr-8 pb-8`로 조정하여 버튼 위치와 정렬합니다.
- **모달 위치 조정**:
    - 모달 컨테이너(`motion.div`)에 `max-w-4xl` 정도로 너비를 살짝 줄여서 한눈에 들어오게 할 수도 있지만, 우선은 위치 이동에 집중합니다.
    - 예상 오프셋: `mt-4` (상단 h-16 영역 아래 배치)
- **애니메이션 최적화**:
    - `initial`과 `exit` 시의 `y` 값을 `-20`으로 수정하여 버튼에서 내려오는 느낌 부여

## 3. 검증 계획
1. `App Hub` 버튼 클릭 시 모달이 왼쪽 상단에 나타나는지 확인
2. 모달이 버튼을 가리지 않는지 확인
3. ESC 키나 배경 클릭 시 정상적으로 닫히는지 확인
4. 애니메이션이 부드럽게 동작하는지 확인

---
형님, 위 계획대로 진행할까요? 🐧✨
