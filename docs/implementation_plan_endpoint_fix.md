# NetTraffic 엔드포인트 감지 범위 확대 계획

형님, UUID가 없는 녀석들도 엔드포인트로 잘 대접해 주겠습니다! 🐧⚡
분석해 보니 기존에는 `https://`가 포함된 풀 주소 위주로 엔드포인트를 찾고 있었고, UUID가 없는 일반 경로는 누락되는 경향이 있었습니다.

## 주요 문제 원인
1. **엄격한 URI 정규식**: 기존 정규식은 `https?://`로 시작하는 주소만 엔드포인트로 인식합니다. 로컬 경로(`/api/v1/...`) 등은 무시되었습니다.
2. **트래픽 패턴 기본 키워드**: 기본값이 `ST_APP, https://`로 설정되어 있어, `https://`가 없는 로그는 아예 분석 대상에서 제외되었습니다.
3. **커스텀 정규식 미지원**: 설정 창에는 `extractRegex` 필드가 있지만, 실제 워커 로직에서는 사용되지 않고 있었습니다.

## 제안하는 수정 사항

### 1. [NetTraffic.worker.ts](../../workers/NetTraffic.worker.ts) [MODIFY]
- **URI 정규식 개선**: `https?://` 뿐만 아니라 공백 뒤에 오는 `/`로 시작하는 경로(예: ` GET /api/v1/...`)도 엔드포인트로 인식하도록 정규식을 보강합니다.
- **커스텀 정규식(`extractRegex`) 반영**: 유저가 직접 엔드포인트 추출 규칙을 정규식으로 입력한 경우, 기본 URI 정규식 대신 이를 우선 사용하도록 수정합니다.

### 2. [NetTrafficAnalyzerView.tsx](../../components/NetTrafficAnalyzer/NetTrafficAnalyzerView.tsx) [MODIFY]
- **기본 키워드 완화**: 신규 규칙 생성 시 기본 키워드에서 `https://`를 제거하여, 더 넓은 범위의 로그가 분석될 수 있도록 유도합니다.

## 검증 계획

### 수동 검증
- `/api/v1/status` 와 같이 UUID가 없고 `https://`가 생략된 경로가 포함된 로그를 입력하여 `Endpoints` 탭에 정상적으로 노출되는지 확인합니다.
- 유저가 `extractRegex`에 직접 정규식을 입력했을 때, 해당 정규식에 맞는 텍스트가 엔드포인트로 추출되는지 확인합니다.

---
형님, 이대로 진행해도 될까요? OK 해주시면 바로 엔드포인트 범위를 넓혀보겠습니다! 🚀
<button id="proceed_button">Proceed</button>
