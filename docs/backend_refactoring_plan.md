# Refactoring Plan: Monolithic Backend Server (server/index.cjs)

현재 `server/index.cjs`는 약 2,700줄에 달하는 단일 파일로 구성되어 있어, 새로운 기능을 추가할 때마다 리스크가 커지고 있습니다. 이를 기능 단위로 분리하여 500줄 이하의 관리 가능한 모듈들로 재구성하겠습니다.

## 1. Problem Identification
- **Monolithic Structure**: SSH, SDB, Simulator, File System, Search 로직이 모두 한 파일에 집중됨.
- **State Pollution**: 전역 변수로 관리되는 연결 상태들이 섞일 위험이 있음.
- **Maintainability**: 특정 기능을 수정할 때 전체 서버 로직을 훑어야 함.

## 2. Target Architecture
`server/services/` 디렉토리를 활용하여 다음과 같이 역할을 분담합니다.

| 서비스 모듈 | 주요 역할 |
| :--- | :--- |
| `index.cjs` | 서버 기동, 미들웨어 설정, 소켓 초기화 및 이벤트 라우팅 (메인 허브) |
| `sshService.cjs` | SSH 클라이언트 생명주기 관리 및 쉘 스트리밍 |
| `sdbService.cjs` | SDB 프로세스 스폰, 장비 스캔, 재연결 로직 |
| `serialService.cjs` | **(신규)** COM 포트 통신 및 설정 관리 |
| `simulatorService.cjs` | 테스트 모드 로그 시뮬레이션 데이터 생성 |
| `loggerService.cjs` | 로그 버퍼링, 파일 저장, 스트림 플러시 관리 |

## 3. Implementation Roadmap
1. **Phase 1 (Current)**: 시리얼 기능을 `serialService.cjs`로 먼저 구현하여 신규 구조 적용 (진행 중).
2. **Phase 2**: SDB 로직을 `sdbService.cjs`로 이관하여 `index.cjs`의 부피를 대폭 줄임.
3. **Phase 3**: SSH 및 나머지 부가 기능 모듈화.
4. **Phase 4**: `index.cjs`는 오직 라우팅만 담당하도록 최종 슬림화 (500줄 이하 달성).

---
형님! 이 리팩토링은 시리얼 기능 구현과 **병행**하거나, 시리얼 완료 후 **순차적으로** 진행할 수 있습니다. 일단 지금은 시리얼 기능을 분리된 구조로 먼저 완성하겠습니다! 🐧🫡
