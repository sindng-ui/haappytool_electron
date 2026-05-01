# App Hub "버벅임 제로" 최적화 계획 (No-Jank Edition)

## 1. 분석: 왜 버벅이는가? (True Causes)

렌더링 엔진 분석 결과, 시각적인 감성 수치보다 "구조적 설계"로 인한 CPU/GPU 병목이 확인되었습니다.

1. **React Memoization 파괴 (심각)**: `Section.tsx`에서 `AppCard`에 함수를 전달할 때 매번 새로운 화살표 함수(`() => onSelect(id)`)를 생성합니다. 이로 인해 `React.memo(AppCard)`가 무력화되어, 모달이 열릴 때 수십 개의 카드가 불필요하게 연쇄 리렌더링됩니다.
2. **Framer Motion `layout` 오버헤드**: `layout` 속성은 브라우저의 리플로우(Reflow)를 유발하며, 특히 `grid-flow-row-dense` 환경에서는 모든 카드의 좌표를 실시간으로 추적하느라 성능이 급감합니다.
3. **`layoutId` 공유 레이아웃**: 활성화 표시기(`activeIndicator`)에 사용된 `layoutId`는 컴포넌트 간 복잡한 좌표 동기화 로직을 실행하여 연산 비용을 높입니다.
4. **중복된 Stagger 관리**: 부모(`Modal`)가 자식들의 순서를 관리(`staggerChildren`)하는 동시에 자식(`Card`)도 개별 지연시간을 갖는 구조는 불필요한 JS 실행 시간을 늘립니다.

---

## 2. 해결 계획 (Action Plan)

### [MODIFY] components/AppCard.tsx
- **인터페이스 최적화**: `onSelect`, `onRightClick`이 ID를 직접 받도록 변경하여 Props 참조를 안정화시킵니다. (Memoization 복구)
- **`layout` 속성 완전 제거**: 성능의 주범인 레이아웃 추적 로직을 삭제합니다.
- **`layoutId` 제거**: `activeIndicator`를 단순한 CSS Border/Glow 효과로 대체하여 좌표 동기화 부하를 없앱니다.
- **애니메이션 다이어트**: 가장 가벼운 `tween` 방식과 짧은 거리(`y: 10`)만 사용하여 GPU 연산량을 최소화합니다.

### [MODIFY] components/Section.tsx
- **함수 래핑 제거**: `AppCard`에 함수를 전달할 때 인라인 화살표 함수 사용을 중지하고, 부모로부터 받은 함수 참조를 그대로 넘깁니다.

### [MODIFY] components/AppLibraryModal.tsx
- **Stagger 제거**: `staggerChildren`을 없애고 모든 카드가 개별 `random delay`에 따라 독립적으로 애니메이션 되도록 하여 부모의 연산 부하를 제거합니다.

---

## User Review Required
형님, "감성"을 위한 무거운 로직들(`layout`, `layoutId`, `stagger`)을 과감히 걷어내고 **"성능(No-Jank)"**에 올인하겠습니다. 이렇게 하면 렉 없이 번개처럼 열릴 겁니다. 진행할까요?

### [ PROCEED (진행하기) ]
