# Implementation Plan: Test Suite Stabilization 🐧🛡️

형님! 무려 20개의 테스트 실패를 한 번에 잡기 위한 정밀 타격 계획입니다. 원인은 명확하니 빠르게 수정하겠습니다.

## 🛠️ 수정 계획

### 1. `server/index.cjs` 안정화 (SDB/SSH 테스트 실패 해결)
- **문제**: `everythingService`가 초기화되기 전에 `handleSocketConnection`이 호출되어 런타임 에러 발생.
- **해결**: `initSocket` 호출 전에 `if (everythingService?.initSocket)` 체크 가드를 추가합니다. 이는 테스트 환경에서 서비스 모킹 없이도 로직이 계속 진행될 수 있게 합니다.

### 2. `test/ReleaseHistory.test.tsx` 타이밍 보강
- **문제**: CRUD 작업 후 UI 갱신을 기다리는 `waitFor`에서 미세한 타이밍 차이로 실패 발생.
- **해결**: 
    - `Update Release` 버튼 클릭 후 `Updated CRUD` 텍스트가 나타날 때까지 명시적으로 `waitFor`를 추가합니다.
    - 삭제 동작 전후에 `act`를 보강하여 React의 상태 업데이트가 완전히 반영되도록 합니다.
    - 모달이 닫히는 시간을 고려하여 `timeout`을 좀 더 여유 있게 조정합니다.

### 3. `test/components/NupkgSigner/NupkgSigner.test.tsx` 타이머 동기화
- **문제**: 가짜 타이머(`vi.useFakeTimers`) 환경에서 워커의 `setTimeout` 응답이 테스트 코드의 `advanceTimersByTime`과 엇갈림.
- **해결**: 
    - `advanceTimersByTime` 호출 전후에 `act` 블록을 더 명확히 사용합니다.
    - `vi.runAllTimersAsync()`를 활용하여 계층적인 비동기 처리가 모두 완료되도록 보장합니다.

## 🧪 검증 계획
1. 개별 테스트 파일 실행:
   - `npm run test -- test/sdb_connection.test.js`
   - `npm run test -- test/ReleaseHistory.test.tsx`
   - `npm run test -- test/components/NupkgSigner/NupkgSigner.test.tsx`
2. 전체 테스트 실행: `npm run test` (Pass 100% 확인)

형님, 계획이 마음에 드시면 아래 `Proceed` 버튼을 눌러주십쇼! 바로 작업 시작합니다! 🚀

<button id="proceed-button">Proceed</button>
