# 속도계 메인 스레드 감지 로직 개선 계획 🐧⚡

## 개요
SpeedScope JSON 로드 시, 메타데이터에 포함된 PID 정보를 분석하여 실제 메인 작업이 일어나는 스레드를 더 정확하게 자동 선택하도록 개선합니다. 특히 사용자가 보고한 `Procoes32 Proces(1611) (1611) Args:`와 같은 오타 패턴도 지원하며, 추출된 PID와 일치하는 이름을 가진 스레드를 우선적으로 선택합니다.

## 제안된 변경 사항

### [Worker] SpeedScope Parser 🐧🛠️

#### [MODIFY] [SpeedScopeParser.worker.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/workers/SpeedScopeParser.worker.ts)
- `Process32 Process(PID)` 패턴 감지 정규식을 개선하여 오타(`Procoes32`, `Proces`)를 허용합니다.
- 메타데이터 세그먼트에서 PID를 추출한 후, 해당 PID를 이름으로 가지는 프로파일(Thread)이 있는지 확인합니다.
- 일치하는 프로파일이 있다면 해당 프로파일을 `bestIdx`로 설정하여 자동 선택되게 합니다.
- `mainThreadPatterns` 리스트에도 오타 패턴을 추가하여 보완합니다.

## 검증 계획

### 자동 테스트 (Node.js 스크립트)
- 제안된 정규식과 PID 매칭 로직이 다양한 입력값(정상/오타)에 대해 정확하게 PID를 추출하고 인덱스를 반환하는지 확인하는 독립형 스크립트 실행.

### 수동 테스트
- 사용자가 언급한 `Procoes32 Proces(1611) (1611) Args:` 패턴이 포함된 샘플 JSON 데이터를 생성하여 로드했을 때, 1611번 스레드가 자동으로 선택되는지 확인.

---
형님, 이 계획대로 진행할까요? 아래 버튼을 눌러주시면 바로 작업 시작하겠습니다! 🐧🫡

<button id="proceed">Proceed</button>
