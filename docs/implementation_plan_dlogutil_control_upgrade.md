# 🛠️ [구현 계획서] dlogutil 자동 시작 방지 및 확실한 프로세스 진압(pkill) 통합 개선안

형님! 연결 수립 후 로그 스트리밍 자동 시작 차단 및 멈춤 시 단말의 잔여 dlogutil 프로세스를 깨끗하게 청소하기 위한 완벽한 무결성 구현 계획서입니다. 펭펭! 🐧⚡

---

## 🎯 1. 주요 요구사항 및 해결 계획

### ① 연결(SSH/SDB) 완료 시 dlogutil 자동 실행 방지 🔌❌
* **AS-IS**: 단말에 소켓 연결(SSH/SDB)이 성공하면, 백엔드(`server/index.cjs`)에서 강제적으로 `dlogutil` 기본 혹은 커스텀 명령어를 쉘 스트림에 곧바로 흘려보내 실시간 스트리밍이 자동 실행됨.
* **TO-BE**: 연결이 수립되어도 **쉘 스트림 대기 상태로 유지**되며, 사용자가 `Start Logging` 버튼을 직접 누르기 전까지는 `dlogutil`이 실행되지 않도록 자동 명령 전송부를 제거합니다.
* **해결법**:
  - `server/index.cjs` 내 `connect_ssh` 수립 콜백 및 `connect_sdb` 수립 콜백 안에 선언된 `setTimeout` 딜레이 후 `stream.write` / `sdbProcess.stdin.write` 자동 기동 구문을 주석 처리합니다.
  - 이로써 세션 연결은 유지되나, 실제 명령은 형님께서 직접 로깅을 원하실 때만 프론트엔드의 `Start Logging` 트리거를 통해 깨끗하게 날아갑니다.

### ② Stop Logging 시 단말 잔여 dlogutil 프로세스 확실한 진압 (pkill) 🗑️⚡
* **AS-IS**: `Log Center` (LogQuickTagsPopover) 에서 `Stop Logging`을 누를 때 쉘로 단순히 `\x03` (Ctrl+C) 시그널만 보냄. 그러나 `&` 백그라운드 옵션으로 기동되는 `dlogutil` 프로세스는 죽지 않아, 다음 로깅 시 다중 프로세스가 누적되어 CPU/메모리 부하 및 로그 엇박자 출력을 유발함.
* **TO-BE**: `Stop Logging` 시 `\x03`을 먼저 쏘고, 짧은 딜레이 후 **`pkill dlogutil`** 명령어를 명시적으로 전송하여 백그라운드 프로세스까지 철저하게 청소합니다.
* **해결법**:
  - `components/LogViewer/LogQuickTagsPopover.tsx` 의 `handleToggleLogging` 멈춤 구문 내에 300ms 딜레이 타이머를 이식하고 `sendTizenCommand('pkill dlogutil\n')` 을 쏘도록 변경합니다. (기존 `ConfigurationPanel.tsx` 에 구현되어 있던 무결성 청소 로직과 대칭을 맞춥니다!)

---

## 🏗️ 2. 상세 변경 계획 및 대상 파일

### 📂 1. [server/index.cjs](file:///k:/Antigravity_Projects/gitbase/happytool_electron/server/index.cjs)

#### [MODIFY] [server/index.cjs](file:///k:/Antigravity_Projects/gitbase/happytool_electron/server/index.cjs) (SSH & SDB 자동 시작 방지)
* **SSH 부근 (340라인 근처)**:
  ```javascript
  // stream.write(cmdToSend) 부분을 주석 처리하여 자동 실행을 막고 대기 상태 유지
  // stream.write(cmdToSend); ➔ 주석 처리!
  ```
* **SDB 부근 (750라인 근처)**:
  ```javascript
  // sdbProcess.stdin.write(cmdToSend) 부분을 주석 처리하여 자동 실행을 막고 대기 상태 유지
  // sdbProcess.stdin.write(cmdToSend); ➔ 주석 처리!
  ```

---

### 📂 2. [LogQuickTagsPopover.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/LogQuickTagsPopover.tsx)

#### [MODIFY] [LogQuickTagsPopover.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/LogQuickTagsPopover.tsx) (Stop 시 pkill 명령 주입)
* **`handleToggleLogging` 내의 Stop 로직 개정**:
  ```tsx
  if (isLogging) {
      // Stop
      setIsLogging(false);
      if (sendTizenCommand) {
          sendTizenCommand('\x03'); // SIGINT
          setTimeout(() => {
              sendTizenCommand('pkill dlogutil\n');
          }, 300);
      }
  }
  ```

---

## 🧪 3. 검증 계획 (Verification Plan)

### 수동 검증
1. **연결 테스트**: SDB / SSH 연결을 성공시켰을 때, 로그 뷰어 터미널 화면이 대기 상태를 유지하며 자동으로 dlogutil 출력이 마구 쏟아지지 않는지 확인합니다.
2. **로깅 기동 테스트**: `Start Logging` 버튼을 누르면 정상적으로 dlogutil 명령어가 날아가 실시간 스트리밍이 즉시 켜지는지 확인합니다.
3. **로깅 중지 테스트**: `Stop Logging`을 눌렀을 때 `pkill dlogutil`이 백그라운드 단말에 정확히 날아가는지 확인하고, 단말 쉘에서 `ps -ef | grep dlogutil`을 직접 조회하여 다중 프로세스 잔상이 모두 사라지고 오직 1개 세션만 깨끗하게 살아 있음을 육안 검사합니다.

---

## 🚀 Proceed 승인 안내
형님! 검토를 마친 뒤 아래의 **`Proceed`** 신호를 내려주십쇼! 펭귄 bash 키보드 타이핑으로 정교하게 설계된 리눅스 청소부 로직을 완벽하게 주입해 대령하겠습니다! 펭펭! 🐧🏆🔥
