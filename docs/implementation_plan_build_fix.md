# 빌드 에러 (cpu-features) 해결 계획

형님, Electron 빌드 중에 `cpu-features`라는 녀석이 말썽을 부리고 있네요. 이 녀석은 `ssh2` 라이브러리가 CPU 성능 최적화를 위해 쓰는 '선택적(optional)' 모듈인데, 윈도우에서 재빌드하려다 보니 Visual Studio 빌드 도구가 없어서 에러가 나는 상황입니다.

다행히 이 녀석은 **선택적 의존성(optionalDependency)**이라서, 없어도 `ssh2` 기능은 정상적으로 동작합니다. 무거운 Visual Studio를 새로 설치하는 수고를 덜기 위해, 이 녀석을 빌드 대상에서 제외하거나 삭제하는 방향으로 해결하겠습니다!

## 해결 제안

가장 간단하고 확실한 방법은 설치된 `node_modules`에서 에러를 유발하는 `cpu-features`를 제거하는 것입니다. 그러면 `electron-builder`가 재빌드를 시도하지 않아 빌드가 매끄럽게 진행될 겁니다.

### [Component Name] 모듈 정리

#### [DELETE] `node_modules/cpu-features`
- `node_modules/cpu-features` 디렉토리를 삭제하여 빌드 시 네이티브 컴파일 시도를 차단합니다.

## 검증 계획

### 수동 확인
1. `node_modules/cpu-features` 삭제 후 `npm run electron:build` 명령어를 형님께 직접 실행 부탁드리겠습니다. (윈도우 환경 권한 문제 예방)
2. 빌드가 성공하면, 생성된 설치 파일로 앱을 실행하여 SSH 연결 기능에 문제가 없는지 확인합니다.

형님, 이 계획대로 진행해도 괜찮을까요? 'proceed'라고 말씀해 주시면 바로 처치하겠습니다! (WSL에서 제가 먼저 삭제 시도해보고 안되면 형님께 부탁드릴게요!)
