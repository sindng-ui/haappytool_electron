# WASM 콜드 스타트 성능 최적화 계획

첫 필터링 시 WASM 엔진이 초기화되기 전에 메시지가 도착하여 느린 JS Fallback 로직이 실행되는 문제를 해결합니다.

## Proposed Changes

### [Worker] LogProcessor.worker.ts

#### [MODIFY] [LogProcessor.worker.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/workers/LogProcessor.worker.ts)

- `buildLocalFileIndex` 함수 시작 부분에 `initSubWorkers()` 호출 추가.
- 이를 통해 파일 인덱싱(약 2~3초 소요)과 서브워커 WASM 초기화(약 0.5s 소요)를 병렬로 진행합니다.

### [Worker] LogFilterSub.worker.ts

#### [MODIFY] [LogFilterSub.worker.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/workers/LogFilterSub.worker.ts)

- `wasmInitPromise`를 도입하여 `initWasm()`의 완료를 추적합니다.
- `onmessage` 핸들러 시작 부분에서 `await wasmInitPromise`를 추가하여, 필터링 요청 처리 전 반드시 WASM 엔진이 준비되도록 보장합니다.

## Verification Plan

### Automated Tests
- `npm run test`를 통해 기존 필터링 로직에 영향이 없는지 확인.

### Manual Verification
1. 앱 재시작 후 1.4GB(1200만 라인) 로그 파일을 엽니다.
2. 로딩 애니메이션(인덱싱)이 끝난 직후 필터링을 수행합니다.
3. 소요 시간이 기존 5.5초에서 3초 수준으로 개선되었는지 확인합니다.
4. 탭 전환 및 파일 재오픈 시에도 안정적으로 동작하는지 확인합니다.
