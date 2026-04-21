# NupkgSigner 성능 최적화 및 JSZip 로딩 방식 개선 계획 🐧🚀

형님! 회사 PC에서 로딩이 느린 원인을 분석해봤습니다. `JSZip`을 처리하는 방식이 조금 "올드스쿨"하게 되어 있어서 Vite가 제 실력을 발휘하지 못하고 있는 것 같습니다. 특히 회사 PC의 보안 프로그램과 `CHOKIDAR_USEPOLLING` 설정이 만나면 최악의 I/O 병목이 발생할 수 있습니다.

## 🧐 분석 결과

1. **JSZip 중복 관리 및 비효율적 로드**: 
   - `package.json`에도 있고, `public/vendor/jszip.min.js`에도 따로 있습니다.
   - 워커 내에서 `importScripts`로 동적 로드하고 있는데, 이는 Vite의 번들링 및 최적화 대상에서 제외되어 매번 별도의 HTTP 요청과 파싱 오버헤드를 발생시킵니다.
   - 회사 PC의 보안 프로그램이 이 동적 스크립트 로드를 검사하느라 시간이 끌릴 가능성이 높습니다.
2. **Vite 최적화 누락**:
   - `vite.config.ts`의 `optimizeDeps.include` 목록에 `jszip`이 빠져 있어, 개발 서버 시작 시나 해당 플러그인 접근 시 Vite가 다시 분석하느라 지연이 생길 수 있습니다.
3. **I/O 폴링 부하**:
   - `CHOKIDAR_USEPOLLING=true` 설정이 되어 있는데, 이는 `/mnt/k/` 같은 윈도우 마운트 경로에서 파일 변경을 감지하기 위해 CPU와 디스크를 지속적으로 소모합니다. 성능이 낮은 회사 PC에서는 치명적일 수 있습니다.

## 🛠️ 제안하는 작업

### 1. JSZip 로딩 방식 현대화 (ESM 통합)
- `importScripts`를 통한 동적 로드를 제거하고, Vite의 워커 번들링 기능을 활용해 `import JSZip from 'jszip'` 방식으로 일원화합니다.
- 불필요한 `public/vendor/jszip.min.js` 파일을 삭제하여 프로젝트 구조를 정돈합니다.

### 2. Vite 의존성 최적화
- `vite.config.ts`에 `jszip`을 추가하여 사전 번들링(Pre-bundling)되도록 설정합니다. 이렇게 하면 회사 PC에서도 첫 로딩 이후 매우 빠른 속도를 보장합니다.

### 3. 워커 및 유틸리티 코드 정돈
- `nupkgUtils.ts`와 `nupkg.worker.ts`에서 글로벌 변수(`declare const JSZip`) 의존성을 제거하고 타입 안전한 ESM 방식을 사용합니다.

### 4. 성능 부가 제안 (형님 확인 필요)
- `package.json`의 `electron:dev` 스크립트에서 `CHOKIDAR_USEPOLLING=true`를 제거하고 테스트해보실 것을 제안합니다. WSL2 환경에서는 윈도우 경로라도 최근엔 이벤트 전달이 개선된 경우가 많아, 폴링 없이도 동작할 수 있으며 이 경우 I/O 부하가 드라마틱하게 줄어듭니다.

---

## 📋 세부 변경 사항

### [Components - NupkgSigner]

#### [MODIFY] [nupkg.worker.ts](file:///mnt/k/Antigravity_Projects/gitbase/happytool_electron/components/NupkgSigner/workers/nupkg.worker.ts)
- `importScripts` 제거
- `import JSZip from 'jszip'` 추가
- `declare const JSZip` 제거

#### [MODIFY] [nupkgUtils.ts](file:///mnt/k/Antigravity_Projects/gitbase/happytool_electron/components/NupkgSigner/utils/nupkgUtils.ts)
- `import type JSZip` 을 `import JSZip` 으로 변경 (워커 번들에 포함되도록 함)

#### [DELETE] [jszip.min.js](file:///mnt/k/Antigravity_Projects/gitbase/happytool_electron/public/vendor/jszip.min.js)
- 더 이상 필요 없는 정적 벤더 파일 삭제

### [Configuration]

#### [MODIFY] [vite.config.ts](file:///mnt/k/Antigravity_Projects/gitbase/happytool_electron/vite.config.ts)
- `optimizeDeps.include`에 `'jszip'` 추가

#### [MODIFY] [package.json](file:///mnt/k/Antigravity_Projects/gitbase/happytool_electron/package.json)
- `electron:dev` 스크립트에서 `CHOKIDAR_USEPOLLING=true` 제거 검토 (일단 유지하되 형님이 원하시면 제거)

---

## 🧪 검증 계획

### 수동 검증
1. `npm run electron:dev` 실행 시 초기 로딩 속도 체감 확인 (특히 Optimizer 기록 확인).
2. Nupkg Signer 플러그인 진입 후 파일 업로드 및 추출 기능 정상 동작 확인.
3. 재패키징(Step 4) 단계에서 JSZip이 정상 작동하여 `.nupkg` 파일이 생성되는지 확인.

형님, 이 계획대로 진행해볼까요? 승인해주시면 바로 작업 들어가겠습니다! 🐧🚀🥊
