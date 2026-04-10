# [Prototype] S/W 문제점 분석용 RAG 서버 구축 계획

형님, S/W 문제점 관리 시스템(PMS/Jira 등)에 쌓인 방대한 데이터를 활용해서 신규 이슈의 해결 실마리를 찾는 RAG(Retrieval-Augmented Generation) 서버 프로토타입을 만들어보겠습니다. 🐧🚀

## 🎯 목표
- 과거의 S/W 문제점(증상, 원인, 해결책)을 벡터 DB에 저장.
- 새로운 문제 증상이 입력되면, 가장 유사한 과거 사례 3~5개를 찾아 LLM에게 전달.
- LLM이 과거 사례를 바탕으로 "이건 아마도 X 모듈의 타이밍 이슈일 가능성이 높습니다" 같은 **1차 분석 힌트**를 생성하도록 구성.

## 🛠️ 기술 스택 (가상 테스트용)
- **Language**: Python 3.x
- **Framework**: FastAPI (가볍고 빠른 API 서버)
- **Vector DB**: ChromaDB (로컬 설치가 쉽고 강력함)
- **Embedding**: Sentence-Transformers (`all-MiniLM-L6-v2` - 로컬에서 무료로 실행 가능한 경량 모델)
- **Data**: 가상의 SW 이슈 데이터 (`mock_issues.json`)

## Proposed Changes

### [NEW] 프로젝트 구조 (`server/rag_analyst/`)

- `main.py`: FastAPI 서버 (검색 및 분석 API)
- `ingest.py`: 가상 데이터를 벡터 DB에 등록하는 스크립트
- `data/mock_issues.json`: 테스트용 SW 문제점 데이터셋
- `requirements.txt`: 필요한 라이브러리 목록

### [Component] 상세 구현 계획

#### 1. 데이터 모델링 (`data/mock_issues.json`)
과거 이슈를 다음과 같은 구조로 준비합니다:
- `symptom` (증상): "화면 회전 시 네트워크 연결이 끊김"
- `root_cause` (원인): "Activity Lifecycle 변화 시 소켓 핸들이 초기화됨"
- `resolution` (해결책): "객체 유지(Persistence) 로직 추가"

#### 2. Ingestion 로직 (`ingest.py`)
- `mock_issues.json`을 읽어서 `symptom`을 벡터화하여 ChromaDB에 저장합니다.
- 원인과 해결책은 메타데이터로 저장하여 검색 결과와 함께 출력되게 합니다.

#### 3. API 서버 (`main.py`)
- `/analyze` 엔드포인트 구현:
    - 입력: 신규 이슈 증상 (Text)
    - 과정: 
        1. 입력 텍스트 벡터화.
        2. ChromaDB에서 유사 증상 TOP 3 검색.
        3. 검색된 과거 사례들을 조합하여 분석 힌트 텍스트 생성 (LLM 연동 가능하도록 프롬프트 구성).

## Open Questions

> [!IMPORTANT]
> 형님, 본격적인 구현 전에 두 가지만 여쭤볼게요!
> 1. **LLM 연동 여부**: OpenAI API 키를 쓰실 건가요, 아니면 일단 LLM 없이 "유사 사례 검색 결과"만 보여주는 선에서 프로토타입을 만들까요? (로컬 LLM인 Ollama 연동도 가능합니다!)
> 2. **실행 환경**: 현재 WSL 환경에서 Python3 및 venv 사용이 자유로우신지 확인 부탁드립니다.

## Verification Plan

### Manual Verification
1. `ingest.py` 실행하여 가상 데이터 등록.
2. `main.py` 서버 실행.
3. `curl` 등을 이용해 "앱 실행 중 갑자기 멈춤" 같은 증상을 서버에 전달.
4. 서버가 과거에 등록된 "메모리 부족으로 인한 크래시" 등의 유사 사례를 기반으로 힌트를 주는지 확인.

---
형님, 이 계획이 맘에 드신다면 바로 가상 데이터셋부터 만들어서 착수하겠습니다!
