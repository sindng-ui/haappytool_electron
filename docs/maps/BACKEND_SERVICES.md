# 🤖 Backend Services & RAG

> **문서 분리 기준 (Threshold)**: 하위 항목이 100줄을 초과하거나 핵심 기능 명세가 5개 이상 쌓일 경우, 이 문서에서 분리하여 개별 파일로 관리하고 링크만 남깁니다.

### [Backend Core Refactoring] (server/index.cjs) [NEW]
- **Refactoring Strategy (2026-05-09)**:
  - **Phase 1: Serial Service**: 2,600줄이 넘는 monolithic 구조를 탈피하기 위해 시리얼 통신 로직을 `services/serialService.cjs`로 완전 분리. 🐧 구조 혁신!
  - **Service Architecture**: `index.cjs`는 소켓 라우팅만 담당하고, 실제 로직은 각 서비스 모듈(SDB, SSH, Serial 등)이 수행하도록 설계 변경 착수.
- **SDB Engine High-Performance Spawn Optimization (2026-07-23)**: [NEW][HOT]
  - **Non-Blocking Spawn Engine**: `run_host_command` 핸들러에서 15초 타임아웃 및 버퍼 락의 원인이던 `exec()`를 `spawn()` 기반으로 전환. 특수문자가 없을 경우 `shell:false` 직접 실행으로 `cmd.exe` 오버헤드 bypass.
  - **Stream Protection & Stdin auto-close**: stdout/stderr 스트림 강제 destroy 및 stdin 즉시종료로 비인터랙티브 SDB 쉘 무한대기 방지.
  - **Process Management**: `activeProcessesMap` 및 `kill_host_command` 핸들러 추가로 호스트 프로세스 강제 종료 기능 확보. 🐧⚡

### [SW Issue Analyst RAG](file:///k:/Antigravity_Projects/gitbase/happytool_electron/server/rag_analyzer)
과거 S/W 문제점 사례를 기반으로 신규 이슈에 대한 1차 분석 힌트를 제공하는 RAG 서버입니다.
- **RAG Engine (2026-04-11)**:
  - **Vector DB**: `ChromaDB` (Persistent)를 통한 Semantic Search 구현.
  - **Embedding**: `Sentence-Transformers` (all-MiniLM-L6-v2) 로컬 임베딩 적용 (무료/로컬 실행).
  - **API Server**: `FastAPI` 기반 검색 및 분석 API (포트: 8888).
  - **Data Integrity**: `ingest.py` — ID 기반 **Upsert 로직** 적용으로 인덱싱 중복 방지 및 정합성 강화.
  - **Monitoring**: `main.py` — 실시간 검색 쿼리 및 성능 메트릭 **로깅 시스템** 구축 (`rag_server.log`).
- **Process Management (2026-04-11 & 2026-04-22)**:
  - **Lifecycle Guard**: `electron/main.cjs` — Electron 메인 프로세스에서 파이썬 서버 기동/종료를 직접 관리 (`spawn` & `SIGTERM`).
    - **Update (2026-04-16)**: 패키징 시 `.asar` 내부의 파이썬 실행 불가 문제 해결을 위해 `asarUnpack` 적용.
    - **Startup Optimization (2026-04-22)**: 백엔드 서버 준비 즉시 스플래시 화면을 종료하도록 로직 고도화.
  - **UI Integration**: `components/RagAnalyzerTest/index.tsx` — 플러그인 상단에 서버 제어 버튼 추가.

<br>

[🔼 메인 맵으로 돌아가기](../../APP_MAP.md)
