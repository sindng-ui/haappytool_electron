# NetTraffic User Agent 감지 로직 개선 및 버그 수정 계획

형님, 분석해 보니 UA 감지가 잘 안 됐던 이유가 몇 가지 있었습니다! 템플릿이 너무 깐깐하게 대소문자와 특수문자를 따지고 있었도, UA 정보를 한 번 쓰고 바로 버리는 버그도 있었네요. 펭귄 개발자가 시원하게 고쳐보겠습니다! 🐧⚡

## 주요 문제 원인
1. **대소문자 및 구분자 민감도**: 기본 템플릿은 `User Agent>`를 기대하지만, 형님의 로그는 `User agent:` 임박! 대소문자와 구분자가 달라서 매칭이 안 됐습니다.
2. **UA 상태 초기화 버그**: UA 정보를 한 번 매칭해서 보여준 뒤 바로 지워버려서, UA 로그 하나 뒤에 여러 요청이 붙어오는 경우 첫 번째만 UA가 붙고 나머지는 유령(No UA)이 되어버렸습니다.
3. **키워드 대소문자**: 키워드 매칭도 대소문자를 엄격하게 따지고 있었습니다.

## 제안하는 수정 사항

### 1. [NetTraffic.worker.ts](../../workers/NetTraffic.worker.ts) [MODIFY]
- **키워드 매칭 개선**: `cleanLine.toLowerCase().includes(kw.toLowerCase())`를 사용하여 대소문자 구분 없이 키워드를 찾도록 합니다.
- **Regex 유연성**: `templateToRegex`에서 생성되는 정규식에 `i` 플래그를 추가하여 대소문자 구분 없이 UA 정보를 추출합니다.
- **UA 상태 유지**: 트래픽 매칭 후 `currentUAVars = null`로 초기화하던 로직을 제거합니다. 이제 새로운 UA 로그가 나오기 전까지는 마지막으로 파싱된 UA 정보를 계속 유지합니다.

### 2. [NetTrafficAnalyzerView.tsx](../../components/NetTrafficAnalyzer/NetTrafficAnalyzerView.tsx) [MODIFY]
- **기본 템플릿 변경**: `User Agent>` 대신 좀 더 범용적인 `User agent: $(UA)` 스타일로 기본값을 변경하거나, 안내를 강화합니다.
- **기본 키워드 변경**: `User Agent` (대문자) 대신 `user agent` 등 소문자 포함 검색에 대응하도록 안내를 수정합니다.

## 검증 계획

### 자동 테스트
- `workers/NetTraffic.worker.ts` 로직을 테스트할 수 있는 소규모 테스트 스크립트를 `/tmp/test_ua.ts`에 작성하여 실행 (Node.js 환경에서 worker 로직만 별도 검증).

### 수동 검증
- 형님이 주신 로그 샘플을 직접 입력하여 `UA 결과` 탭에서 정상적으로 클러스터링 되는지 확인합니다.
- 동일 UA 아래 여러 API 요청이 묶여서 나오는지 확인합니다.

---
형님, 이대로 진행해도 될까요? OK 해주시면 바로 코딩 들어갑니다! 🚀
<button id="proceed_button">Proceed</button>
