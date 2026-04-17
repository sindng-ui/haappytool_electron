# 📦 신규 모듈 추가 및 의존성 이슈 해결 가이드 (Knowledge Base)

이 문서는 HappyTool 프로젝트에 새로운 외부 라이브러리를 추가하거나, 특정 환경(프록시, 오프라인 등)에서 발생하는 의존성 문제를 해결한 사례를 기록합니다.

---

## 🚀 Case Study 1: JSZip (Vite Worker & Proxy Conflict)

### 1. 문제 상황 (Symptoms)
- **Vite Worker 빌드 에러**: `Rollup failed to resolve import "jszip"` 발생. Vite의 메인 설정(`alias`, `ssr.noExternal`)이 Worker의 별도 Rollup 빌드 파이프라인에 완벽히 상속되지 않음.
- **프록시 환경 제약**: 회사 PC 등 보안망 환경에서 `npm install`이 차단되어 신규 패키지를 받아오지 못하는 현상 발생.

### 2. 시도 및 실패 기록 (Wrong Turns)
- **`vite.config.ts` 설정**: `alias`나 `optimizeDeps`를 시도했으나, 환경마다 `node_modules` 경로 해석이 달라지거나 Worker 빌드에서 무시되는 현상 발생.
- **Local Vendor Import**: `import JSZip from '../vendor/jszip.js'` 방식으로 소스 내에 포함시켰으나, 라이브러리가 UMD/CJS 형식이라 Rollup이 `require` 문을 해석하지 못해 빌드 에러 발생.

### 3. 최종 정답 (Golden Solution)
1. **Public Vendor화**: 라이브러리의 standalone 번들(`jszip.min.js`)을 `public/vendor/` 폴더로 이동. (Vite 빌드 도구의 간섭을 받지 않는 성역)
2. **Runtime Loading (Worker)**: Worker 파일 내부에서 ESM `import` 대신 `self.importScripts('/vendor/jszip.min.js')`를 사용. 
   - **이점**: 빌드 도구가 라이브러리 내부 코드를 해석(resolve)하지 않으므로 빌드 에러가 원천 차단됨.
3. **Type-Only Import**: 소스 코드(`nupkgUtils.ts` 등)에서는 `import type JSZip from 'jszip'`만 사용하여, 빌드 결과물에는 실체가 포함되지 않게 하면서도 IDE의 타입 지원은 그대로 유지함.
4. **Offline Ready**: 라이브러리 실체가 `public` 폴더에 박혀있으므로, `npm install` 없이 `git pull`만으로 어느 환경에서든 빌드 가능.

---

## 🛠️ 신규 모듈 추가 시 체크리스트

1. **외부망 의존성 확인**: 이 모듈을 추가했을 때 프록시 환경의 다른 PC에서도 `npm install` 없이 돌아갈 수 있는가? 
   - 필요 시 `public/vendor/`에 라이브러리 직접 포함 고려.
2. **Worker 사용 여부**: Worker 내부에서 해당 모듈을 쓰는가?
   - 그렇다면 `importScripts` 방식이 빌드 안정성 측면에서 훨씬 유리함.
3. **타입 안정성**: `import type`을 활용하여 런타임 코드와 타입을 분리했는가?
