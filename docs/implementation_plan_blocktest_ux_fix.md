# Implementation Plan - BlockTest Pipeline UX Improvement 🛠️

BlockTest 플러그인에서 파이프라인 관리 시 발생하는 `prompt()` 지원 에러를 해결하고, 삭제 시 안전장치(확인 팝업)를 추가하여 사용자 경험을 개선합니다.

## 1. 개요
- **목표**: 
    1. Electron 환경에서 지원되지 않는 `window.prompt()`를 커스텀 React 모달로 대체.
    2. 파이프라인 삭제 시 즉시 삭제되는 문제를 방지하기 위해 삭제 확인(Confirmation) 모달 도입.
- **주요 기술**: React, Framer Motion (애니메이션), Lucide-React (아이콘), Tailwind CSS (스타일링).

## 2. 상세 작업 내역

### 2.1 신규 컴포넌트 생성 (`components/BlockTest/components/PipelineDialogs.tsx`)
- **RenamePipelineDialog**:
    - 파이프라인 이름을 입력받는 모달.
    - 현재 이름을 기본값으로 가지는 Input 필드 제공.
    - Framer Motion을 활용한 부드러운 Scale & Opacity 애니메이션 적용.
    - 테마(`THEME`)와 일치하는 다크 모드 스타일링.
- **DeleteConfirmDialog**:
    - "정말로 삭제하시겠습니까?"를 묻는 확인 모달.
    - 삭제 대상 파이프라인 이름을 표시하여 명확성 확보.
    - 위험 동작임을 알리는 Red 계열의 강조 스타일링 적용.

### 2.2 메인 컴포넌트 수정 (`components/BlockTest/index.tsx`)
- **상태 관리 추가**:
    - `isRenameModalOpen`, `isDeleteModalOpen` 상태 추가.
    - `modalData` (현재 수정/삭제 대상 파이프라인 객체) 관리.
- **로직 변경**:
    - Rename 버튼 클릭 시 `window.prompt()` 대신 `RenamePipelineDialog`를 오픈.
    - Delete 버튼 클릭 시 바로 `deletePipeline`을 호출하지 않고 `DeleteConfirmDialog`를 오픈.
    - 모달의 'Confirm' 클릭 시에만 실제 API(`updatePipeline`, `deletePipeline`) 호출.

### 2.3 문서 업데이트 (`important/APP_MAP.md`)
- `BlockTest Plugin` 섹션에 새로 추가된 다이얼로그 컴포넌트와 개선된 UX 로직 명시.

## 3. 디자인 가이드 (Premium UX)
- **Glassmorphism**: 배경에 은은한 블러(`backdrop-blur-md`)와 반투명 배경 적용.
- **Micro-animations**: 버튼 호버 시 살짝 커지는 효과 및 모달 등장 시 튕기는 듯한 Spring 애니메이션.
- **Accessibility**: ESC 키로 닫기 지원 및 포커스 관리.

## 4. 검증 계획
- [ ] Rename 모달에서 빈 이름 입력 시 방어 로직 확인.
- [ ] 삭제 취소 시 파이프라인이 유지되는지 확인.
- [ ] Electron 환경에서 에러 없이 정상적으로 모달이 동작하는지 확인.

---
형님, 이 계획대로 진행해도 될까요? **Proceed** 버튼 눌러주시면 바로 코딩 들어갑니다! 🐧🚀
