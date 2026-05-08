# Implementation Plan: Tizen Serial Connection Support

Tizen Connection Modal에 Serial(COM Port) 연결 모드를 추가하여 하드웨어 직접 연결을 통한 로깅을 지원합니다.

## 1. Backend (Server) Changes
- **Package**: `server` 디렉토리에 `serialport` 패키지 설치.
- **`server/index.cjs`**:
    - `serialport` 모듈 로드.
    - `list_serial_ports`: 시스템의 사용 가능한 COM 포트 목록을 반환하는 이벤트 추가.
    - `connect_serial`: 선택된 포트 및 설정(BaudRate 등)으로 연결 시도.
    - `disconnect_serial`: 연결 종료.
    - `serial_write`: 프론트엔드에서 보낸 명령어를 시리얼 포트로 전송.
    - **Data Flow**: 시리얼 포트에서 들어오는 데이터를 기존 `handleLogData` 함수로 전달하여 프론트엔드에 스트리밍.

## 2. Frontend Changes
### 2.1 TizenConnectionModal.tsx
- **UI 확장**:
    - Mode Selection에 `Serial` 탭 추가.
    - Serial 전용 폼 추가:
        - `Port`: 드롭다운 메뉴 (백엔드에서 받은 목록 표시).
        - `Baud Rate`: 입력창 (기본값 115200).
        - `Advanced Settings`: Data bits, Stop bits, Parity 등 (기본값 제공).
- **Socket 연동**:
    - `serial_ports`: 서버로부터 포트 목록 수신.
    - `serial_status`, `serial_error`: 연결 상태 및 에러 처리.
    - `handleConnect`: 모드가 `serial`일 때 서버로 `connect_serial` 이벤트 발송.

### 2.3 hooks/useTizenConnection.ts
- **상태 확장**: `connectionMode` 타입에 `'serial'` 추가.
- **로직 업데이트**:
    - `handleTizenStreamStart`: `'serial'` 모드 지원.
    - `sendTizenCommand`: `'serial'` 모드일 때 서버로 `serial_write` 이벤트 발송.
    - `handleClearLogs`: 시리얼 연결 시에도 버퍼 비우기 지원 (장비 명령어 전송은 생략하거나 별도 처리).

## 3. Stability & Safety
- **Isolaton**: Serial 포트 객체(`serialPort`)를 별도의 전역 변수로 관리하여 SDB(`sdbProcess`)나 SSH(`sshConnection`)와 섞이지 않도록 함.
- **Error Handling**: 포트 점유 중이거나 접근 권한 문제 시 명확한 에러 메시지 제공.

---
형님, 계획이 마음에 드신다면 **Proceed**를 눌러주세요! 바로 작업을 시작하겠습니다. 🐧🫡
