# Implementation Plan - App Hub Performance Optimization 🚀

형님! App Hub의 성능을 극한으로 끌어올리고 구조를 깔끔하게 다듬기 위한 계획서입니다. 🐧⚡

## 1. 개요
현재 App Hub와 App Library Modal은 화려한 애니메이션과 Bento Grid 레이아웃을 갖추고 있으나, 플러그인 수가 많아질수록 초기 진입 애니메이션 및 리렌더링 오버헤드가 발생할 가능성이 있습니다. 이를 위해 구조적 개선과 애니메이션 로직 최적화를 진행합니다.

## 2. 주요 최적화 전략

### A. 컴포넌트 구조 분리 (Refactoring)
- `AppLibraryModal.tsx`에서 `AppCard`와 `Section`을 독립된 컴포넌트 파일로 분리합니다.
- 파일당 500줄 규칙을 준수하고 각 컴포넌트의 책임 범위를 명확히 합니다.

### B. 애니메이션 로직 최적화
- **Staggered Entrance**: 개별 카드의 `delay` 계산 대신 Framer Motion의 `staggerChildren`을 부모(`Section`)에서 사용하여 선언적이고 효율적인 애니메이션을 구현합니다.
- **State Management**: `isEntranceDone` 상태를 카드마다 두지 않고, 부모 수준에서 통합 관리하거나 Framer Motion의 `variants`를 활용해 상태 업데이트 없이도 '초기 진입'과 '상호작용' 트랜지션을 분리합니다.
- **Hardware Acceleration**: `will-change: transform`을 적절히 활용하고, GPU 부하가 큰 `backdrop-filter` 수치를 최적화합니다.

### C. 리렌더링 최적화
- `React.memo`와 `useCallback`을 철저히 적용하여, 특정 카드의 사이즈 변경이나 핀 상태 변경 시 다른 카드들이 불필요하게 리렌더링되는 것을 방지합니다.
- `pluginSizes` 상태 전달 방식을 개선하여 관련 없는 컴포넌트의 업데이트를 차단합니다.

### D. 레이아웃 최적화
- `layout` 프로퍼티는 측정 비용이 발생하므로, Bento Grid의 크기 변화가 일어나는 시점에만 효율적으로 동작하도록 설정합니다.

## 3. 상세 작업 단계

| 단계 | 작업 내용 | 파일 |
| :--- | :--- | :--- |
| **1단계** | `AppCard.tsx`, `Section.tsx` 파일 생성 및 로직 이관 | `components/AppCard.tsx`, `components/Section.tsx` |
| **2단계** | `AppLibraryModal.tsx` 리팩토링 및 신규 컴포넌트 적용 | `components/AppLibraryModal.tsx` |
| **3단계** | `staggerChildren` 적용 및 개별 카드 delay 로직 제거 | `components/Section.tsx`, `components/AppCard.tsx` |
| **4단계** | `isEntranceDone` 통합 관리 및 interaction 성능 개선 | `components/AppLibraryModal.tsx` 등 |
| **5단계** | 최종 성능 체크 및 Side Effect 확인 | 전역 |

## 4. 기대 효과
- **초기 로딩 속도 향상**: 대량의 `setState` 호출 감소로 모달 오픈 시 jank 현상 제거.
- **애니메이션 부드러움 증대**: Framer Motion 엔진 최적 활용으로 60fps 유지.
- **유지보수성 향상**: 컴포넌트 분리를 통한 가독성 및 재사용성 확보.

형님, 이대로 진행해도 될까요? "Proceed" 버튼 눌러주시면 바로 작업 들어갑니다! 🐧💪

<button id="proceed_optimization">Proceed</button>
