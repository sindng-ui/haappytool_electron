# APP_MAP.md 가지치기(Refactoring) 계획서

## 1. 개요
현재 단일 파일로 관리되어 방대해지고 있는 `APP_MAP.md`를 루트 문서(Index)와 여러 하위 도메인 문서로 분리하여 굴비 엮듯 연결하는 구조로 전면 개편합니다.

## 2. 문서 분리 기준 (Split Rule)
앞으로 `APP_MAP.md` 및 하위 문서들의 상단에 다음의 **'문서 가지치기 기준'**을 명시하여 일관성을 유지합니다.
*   **분리 기준 (Threshold)**: 특정 줄기(섹션)의 라인 수가 **100줄을 초과**하거나, 내부에 상세히 기술해야 할 하위 컴포넌트/기능이 **5개 이상** 쌓여 가독성을 해치는 시점.
*   **작업 방식**: 해당 줄기를 `docs/maps/` 디렉토리 하위의 독립된 마크다운 파일로 분리. 부모 문서에는 핵심 요약과 함께 하위 문서로 향하는 링크(`[상세 보기](./docs/maps/...)`)만 남김.

## 3. 구조 개편 목표 (현재 상태 분할)
현재 `APP_MAP.md`의 4대 큰 줄기를 다음과 같은 파일 구조로 엮습니다.

*   **`APP_MAP.md` (Root Index)**
    *   앱 전체의 조감도 및 진입점.
    *   문서 분할(가지치기) 기준 공식 명시.
    *   아래 4개의 하위 문서로 향하는 링크와 간략한 역할 요약만 제공.

*   **하위 문서 (신규 생성: `docs/maps/` 폴더)**
    1.  `docs/maps/PLUGINS.md` 
        - Log Analysis Agent, Nupkg Signer, Release History 등 
    2.  `docs/maps/UI_COMPONENTS.md`
        - Log Extractor, SpeedScope, NetTraffic, App Hub, Common Dialogs 등 핵심 UI 
    3.  `docs/maps/BACKEND_SERVICES.md`
        - Node(Express/Socket) 서버, Serial 통신 모듈, RAG 파이썬 엔진 등 백엔드/데이터 계층
    4.  `docs/maps/STANDARD_GUIDES.md`
        - 코드 리뷰 지침, 의존성(Proxy/Build) 해결 가이드 등 표준화 문서

## 4. 진행 순서
1.  `docs/maps/` 디렉토리를 생성합니다.
2.  현재 `APP_MAP.md`의 세부 내용을 복사하여 4개의 도메인에 맞는 새로운 마크다운 파일들로 이주(Migration)시킵니다.
3.  기존 `APP_MAP.md` 파일의 내용들을 모두 지우고, 인덱싱 링크와 분리 기준만이 명시된 슬림한 메인 허브로 재작성합니다.

---
**진행하시겠습니까?** 형님, 위 계획대로 굴비를 엮을까요?
[PROCEED]
