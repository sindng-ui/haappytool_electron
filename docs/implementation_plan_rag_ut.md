# RAG 서버 단위 테스트(UT) 환경 구축 및 테스트 케이스 작성 계획 🐧🧪

형님! RAG 서버가 안정적으로 돌아가는지 확인할 수 있도록 제대로 된 테스트 슈트를 만들어 보겠습니다. 단순히 스크립트를 돌리는 게 아니라, `pytest`를 도입하여 전문적으로 검증할 수 있는 환경을 구축하겠습니다!

## 유저 리뷰 필요 사항

> [!NOTE]
> 테스트를 위해 `pytest`와 `httpx` 패키지 설치가 필요합니다. `requirements.txt`에 추가할 예정인데 괜찮으실까요?

## Proposed Changes

### [Server] RAG 서버 테스트 환경 구축

#### [NEW] [test_api.py](file:///k:/Antigravity_Projects/gitbase/happytool_electron/server/rag_analyzer/tests/test_api.py)
- `FastAPI`의 `TestClient`를 사용하여 다음 엔드포인트들을 검증합니다:
    - `GET /`: 서버 생동 확인
    - `GET /status`: 인덱싱 상태 확인
    - `GET /search`: 검색 기능 (정상 케이스 및 빈 검색어 등 예외 케이스)

#### [NEW] [test_db.py](file:///k:/Antigravity_Projects/gitbase/happytool_electron/server/rag_analyzer/tests/test_db.py)
- `ChromaDB` 연동 로직을 검증합니다:
    - 데이터 삽입 및 인덱싱 카운트 일치 여부
    - 유사도 검색 결과의 유효성

#### [MODIFY] [requirements.txt](file:///k:/Antigravity_Projects/gitbase/happytool_electron/server/rag_analyzer/requirements.txt)
- `pytest`, `httpx`를 추가하여 테스트 실행이 가능하도록 합니다.

#### [NEW] [run_tests.sh](file:///k:/Antigravity_Projects/gitbase/happytool_electron/server/rag_analyzer/run_tests.sh)
- 🐧 리눅스 개발자답게 한 방에 테스트를 돌릴 수 있는 쉘 스크립트를 제공합니다.

---

## 검증 계획

### 자동화 테스트
- [ ] `pytest` 명령어를 통해 모든 테스트 케이스 통과 확인
- [ ] 검색 결과가 예상된 포맷(`hints`, `query` 등)으로 나오는지 검증

### 수동 확인
- [ ] 서버에 데이터가 없을 때의 예외 처리 확인

---

형님, 테스트 환경을 이렇게 잡아보려고 하는데 "영차" 한 번 해주시면 바로 작업 들어 가겠습니다! 🐧🚀🛡️
