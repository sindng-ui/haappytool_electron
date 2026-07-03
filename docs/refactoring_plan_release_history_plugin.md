# 🛠️ ReleaseHistoryPlugin.tsx 500줄 초과 리팩토링 계획서

형님! 다중 Division 기능을 반영한 결과, `ReleaseHistoryPlugin.tsx` 파일이 **524줄**에 도달하여 프로젝트의 **500줄 제한 규칙**을 초과했습니다.
이에 따라 상태 관리 로직과 마이그레이션 로직을 깨끗하게 격리하는 리팩토링을 즉각 수립하여 제출합니다.

---

## 📋 리팩토링 방안

### 1. 커스텀 훅 추출 (`useReleaseHistoryDivisions`)
`ReleaseHistoryPlugin.tsx` 내부에 있던 다음과 같은 데이터 상태 제어 및 로컬 스토리지 라이프사이클 코드를 신규 커스텀 훅으로 격리 분리합니다.
- **분리 파일 경로**: [useReleaseHistoryDivisions.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/ReleaseHistory/hooks/useReleaseHistoryDivisions.ts) (신규)
- **추출 대상 로직**:
  - `divisions` 및 `activeDivision` 상태(state)
  - `useEffect`를 통한 로컬 스토리지 데이터 로드 및 구버전 마이그레이션
  - `useEffect`를 통한 변경 데이터의 로컬 스토리지 자동 저장
  - 현재 `activeDivision`에 따른 `items` 및 `yearConfigs` 파생 state
  - `updateActiveDivisionItems`, `updateActiveDivisionYearConfigs` 상태 업데이트 헬퍼 함수
  - `handleAddDivision`, `handleDeleteDivision` 디비전 추가/삭제 제어 로직

### 2. `ReleaseHistoryPlugin.tsx` 파일 슬림화
위의 로직이 커스텀 훅으로 추출되면 `ReleaseHistoryPlugin.tsx`는 UI 렌더링 및 모달 팝업 컨트롤러 역할만 남게 되며, 파일 크기가 **약 390줄 수준**으로 슬림해집니다.

---

## 📈 예상 라인 수 변화

| 파일명 | 리팩토링 전 줄 수 | 리팩토링 후 예상 줄 수 |
| :--- | :---: | :---: |
| `ReleaseHistoryPlugin.tsx` | 524줄 | **~390줄** |
| `useReleaseHistoryDivisions.ts` | 0줄 (신규) | **~120줄** |

---

## 🛡️ Zero-Regression 검증 계획
- 리팩토링 전/후의 `ReleaseHistoryPlugin` 동작은 100% 동일함을 보장합니다.
- `vitest` 단위 테스트(`test/ReleaseHistory.test.tsx`)를 실행하여 마이그레이션 및 CRUD 기능의 무결성을 재검증합니다.
- 타입 검사 실행: `wsl npx tsc --noEmit`

---

형님, 리팩토링 계획을 검토해 주시고 승인하시면 "Proceed"라고 말씀해 주십시오. 즉시 훅 분리 리팩토링과 테스트 검증을 완료하겠습니다! 🐧🔥
