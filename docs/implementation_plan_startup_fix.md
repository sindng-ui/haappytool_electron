# 부팅 속도 지연(Vite 로딩 최적화) 이슈 진단 및 해결 계획

형님, NupkgSigner 추가 후 앱 부팅 속도가 지연되면서 스플래시 화면에 가짜 로그(`[SYSTEM] Warming up...`)가 무한 반복되는 치명적인 병목 구조를 완벽하게 파악했습니다! 🐧🕵️‍♂️

## 🔍 Root Cause Analysis (원인 분석)

1. **Vite Worker 번들링 병목장애 (핵심 원인)**:
   - `NupkgSigner`에서 `import NupkgWorker from './workers/nupkg.worker?worker'` 방식을 사용하고 있습니다.
   - Vite 환경에서 `?worker` 문법을 만나면, 개발 모드임에도 빠른 `esbuild`를 사용하지 않고 무거운 **Rollup** 엔진을 돌려 워커와 거대한 `jszip`을 하나의 파일로 묶어버립니다. (여기서 10~15초 증발!)
2. **Main 프로세스 IPC 이벤트 교착 상태 (데드락)**:
   - `main.cjs` 초기화 로직에 `await Promise.all([windowLoadPromise, serverStartPromise])` 방어막이 쳐져 있습니다. 
   - Vite가 Worker를 번들링 하느라 `did-finish-load` 이벤트가 늦어지면, 백엔드 서버는 1초만에 켜졌음에도 불구하고 `loading-complete` 신호를 랜더러(React) 측에 보내지 못하고 무한정 대기합니다.
   - React 쪽의 스플래시 스크린 컴포넌트는 `loading-complete`가 올 때까지 종료(Fade out) 타임아웃을 발동시키지 못해 로그루프를 돌게 된 것입니다.

## 🛠 Proposed Changes

### 1. [MODIFY] [components/NupkgSigner/index.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/NupkgSigner/index.tsx)
- `import NupkgWorker from './workers/nupkg.worker?worker'` 구문을 삭제합니다.
- 대신 표준 ESM 방식을 사용하여 롤업(Rollup) 번들링 회피:
  ```typescript
  const worker = new Worker(new URL('./workers/nupkg.worker.ts', import.meta.url), { type: 'module' });
  ```

### 2. [MODIFY] [electron/main.cjs](file:///k:/Antigravity_Projects/gitbase/happytool_electron/electron/main.cjs)
- `await Promise.all([windowLoadPromise, serverStartPromise])` 구조 격파!
- 랜더러가 준비되기 전이라도, 백엔드 서버가 구동완료(`serverStartPromise`)되는 즉시 `startupStatus.isComplete`를 업데이트하고 `loading-complete` 이벤트를 발사하게끔 분리시킵니다. (React가 뜨자마자 스플래시가 종료될 수 있도록)
