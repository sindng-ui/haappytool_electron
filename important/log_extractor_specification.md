# Log Extractor 상세 명세 (Antigravity 용)

이 문서는 미래의 구글 Antigravity AI가 HappyTool의 핵심 기능인 **Log Extractor**를 정확하게 이해하고 유지보수/확장할 수 있도록 돕기 위해 작성되었습니다.

---

## 🚀 Mission (Rule) & Configuration

Log Extractor의 모든 동작은 **Mission(또는 Rule)**이라는 설정 단위로 관리됩니다. `Ctrl + \`` 단축키를 통해 설정 패널을 여닫을 수 있습니다.

### 1. Configuration 주요 항목
- **Happy Combo (해피 콤보)**: 
    - **OR of ANDs** 로직을 사용합니다.
    - 각 그룹(Group) 내의 단어들은 모두 포함되어야 하며(**AND**), 그룹 간에는 하나라도 만족하면(**OR**) 로그가 표시됩니다.
    - 예: `[word1, word2]` (1번 그룹) OR `[word3]` (2번 그룹)
- **Family Combo (패밀리 콤보)**: 
    - 시작(Start), 끝(End), 중간(Middle/Branch) 태그를 이용한 계층적 필터링입니다.
- **Block List (블록 리스트)**: 
    - 특정 단어가 포함된 로그를 제외합니다.
- **Color Highlight (컬러 하이라이트)**: 
    - 특정 키워드에 대해 수동으로 색상을 지정합니다.
- **Log Settings (로그 설정)**: 
    - 실시간 로깅에 대한 Log Command, Log Tag 등을 설정합니다. 
    - `showRawLogLines` (비표준 로그 강제 표시 여부)를 설정합니다.

---

## 🎨 자동 색상 지정 (Auto-Highlight) 스펙

콤보에 단어를 추가하고 별도의 색상을 지정하지 않으면, 시스템이 **고정된 색상**을 자동으로 할당합니다.

- **로직**: `stringToColor` 유틸리티를 사용합니다. 단어의 문자열 해시값을 기반으로 **HSL 컬러**를 생성합니다.
    - **Saturation**: 70-100% (선명도 유지)
    - **Lightness**: 50-60% (텍스트 가독성을 위해 중간 명도 유지)
- **우선순위**: 사용자가 직접 지정한 Color Highlight가 자동 색상보다 우선합니다.
- **대소문자 구분**: 설정의 `caseSensitive` 옵션에 따라 키워드 매칭 및 색상 칠하기 로직이 연동됩니다.

---

## 🖋️ 폰트 및 렌더링

- **폰트 지원**: `Consolas`, `JetBrains Mono`, `Monospace` 등 고정폭 폰트를 지원합니다.
- **성능 최적화**: 고정폭 폰트의 경우, 첫 렌더링 시 글자 너비를 측정하여 캐싱합니다. 이후 모든 렌더링 시 `O(1)` 속도로 텍스트 위치를 계산합니다.

---

## ⚡ 초고속 성능 (Performance)

1GB 이상의 대용량 로그도 끊김 없이 처리하기 위한 기술적 장치들입니다.

- **Segmentation (세그멘테이션)**: 브라우저의 Canvas/DOM 높이 제한을 넘기 위해 `MAX_SEGMENT_SIZE`(약 135만 줄) 단위로 페이징 처리를 합니다.
- **캔버스 아키텍처 (HyperLogRenderer)**: 
    - **Layer 1 (Background)**: 선택 영역, 북마크, 키워드 배경 등을 렌더링합니다.
    - **Layer 2 (Text)**: 실제 로그 텍스트와 하이라이트 오버레이를 렌더링합니다.
    - 60fps의 부드러운 스크롤을 보장합니다.
- **Web Worker**: 인덱싱, 필터링, 검색 등 무거운 작업은 백그라운드 워커에서 처리하여 UI 스레드를 차단하지 않습니다.
- **WASM 가속**: 단순한 OR 필터링의 경우 Rust로 작성된 WebAssembly 엔진을 사용하여 처리 속도를 극대화합니다.

---

## 📡 SDB/SSH 실시간 로깅

- **실시간 스트리밍**: SDB(Tizen) 또는 SSH를 통한 실시간 로그 수집을 지원합니다.
- **Burst Logging 대응**: 초당 수만 줄의 로그가 쏟아지는 상황에서도 UI가 얼지 않도록 **Chunk 단위 버퍼링 및 배치 처리** 로직이 구현되어 있습니다.
- **로그 버퍼 클리어**: `Ctrl + Shift + X`를 통해 프론트엔드의 화면과 서버 측의 로그 버퍼를 동시에 비울 수 있습니다.

---

## 🔍 Find & Focus

- **Find (fint)**: 현재 열려있는 세그먼트 내에서 빠른 텍스트 검색을 지원합니다.
- **Focus 모드**: 
    - 글로벌 설정에서 활성화 시, 로그 열람에 집중할 수 있도록 `TopBar` 등 UI 요소를 자동으로 숨깁니다.
    - 마우스 이동이나 특정 단축키 입력 시 UI가 다시 나타납니다.
    - `isSearchFocused` 상태일 때는 단축키 오동작을 방지하기 위해 일반적인 핫키가 차단됩니다.

---

## 🖇️ 북마크 (Bookmarks)

- **토글**: `Space` 키로 현재 줄에 북마크를 설정/해제합니다.
- **이동**: `F3` (이전 북마크), `F4` (다음 북마크)로 빠르게 점프합니다.
- **북마크 보기**: `Ctrl + B`로 전체 북마크 리스트를 확인하고 관리할 수 있습니다.

---

## 🖱️ 드래그 및 상호작용 (Selection)

HyperLogRenderer 위에 투명한 **Interaction Layer**를 두어 복잡한 선택 로직을 구현했습니다.

- **기본 드래그**: 여러 줄을 선택하여 범위를 지정합니다.
- **Shift / Ctrl / Alt 드래그**:
    - **Shift + Click**: 범위 선택 (Anchor 기준).
    - **Ctrl + Click**: 개별 라인 다중 선택 (Toggle).
    - **Alt + Drag**: 커스텀 선택 로직을 우회하여 **브라우저 네이티브 텍스트 선택**을 수행합니다. (특정 단어만 긁을 때 유용)
- **Ctrl + C**: 선택된 라인들을 클립보드에 복사합니다. (마지막 줄 개행 제거 등 최적화 포함)
- **Save to Archive**: 선택 영역 위에서 마우스 우클릭 -> `Save Selection to Archive`를 선택하면 해당 구간만 로그 아카이브에 영구 저장됩니다.
- **시간 차 계산 (Time Difference)**: 
    - 두 줄 이상을 선택하면, 선택된 구간의 **첫 줄과 끝 줄 사이의 시간 차이**를 화면 하단에 표시합니다.
    - `HH:mm:ss.mss` 형태부터 커널 타임 `[seconds.micros]`까지 다양한 포맷을 자동 인식합니다.
- **트랜잭션 ID 추출 (Transaction ID Extraction)**:
    - 선택된 로그에서 트랜잭션 ID를 추출합니다.
    - 추출된 트랜잭션 ID를 기반으로 다른 패널에서 해당 트랜잭션의 로그를 찾습니다.
- 로그 우클릭시 context menu
    - Save Selection to Archive
    - Analyze Transaction
    
---

## 📊 Analyze Performance (Flame Map)

성능 분석(Analyze Performance) 기능은 로그 데이터를 기반으로 시스템의 동작 시간과 병목 구간을 시각화하는 기능입니다. (Flame Map 형태 제공)

### 1. 목적 (얻을 수 있는 결과)
- **병목 구간 식별**: 특정 작업이나 흐름에서 임계값(Threshold)을 초과하여 지연이 발생한 구간을 한눈에 파악합니다.
- **시각적 프로파일링**: 로그의 텍스트만으로는 파악하기 힘든 시스템 로딩, 화면 전환, 트랜잭션 등 일련의 과정에 대한 소요 시간을 차트(Chart) 및 리스트(Bottlenecks) 형태로 직관적으로 시각화합니다.
- **정확한 로깅 추적**: 지연이 발생한 시작/끝 지점의 원본 로그(Raw View)로 정확하게 점프하여 원인을 분석할 수 있습니다.

### 2. 조건 및 사용 데이터
- **활성화 조건**: Rule(설정) 내에 `perfThreshold`(성능 임계값, ms 단위)와 분석 그룹(`happyGroups` 내의 `alias` 및 `tags`)이 정의되어 있어야 합니다.
- **사용 데이터**:
    - 활성화된(enabled) 탭/그룹별 필터링된 로그 라인들.
    - 해당 로그의 타임스탬프(`extractTimestamp` 결과값).
    - 로그의 원본 줄 번호(originalLineNumber) 및 필터링된 줄 번호.
- **분석 로직 (유형)**:
    - **Step (Group)**: 동일한 `alias`를 가진 그룹 내의 첫 로그와 마지막 로그 간의 시간 차이를 분석합니다. (단일 작업의 소요 시간 측정)
    - **Combo (Interval)**: 매칭된 A 시점과 다음 B 시점 사이의 시간(Transitional timeframe)을 분석합니다. (단계별 넘어가는 속도 측정)

### 3. 분석 시점 (언제 수행되는가)
- 우측 상단의 `Analyze Performance` (번개 아이콘) 버튼을 **명시적으로 클릭**할 때만 수행됩니다.
- 대용량 데이터 분석 시 UI 블로킹을 방지하기 위해 **Web Worker** 화면단 백그라운드에서 비동기(`PERF_ANALYSIS` 메시지 트리거)로 연산됩니다.

### 4. 세부 사항 및 한계점
- **데이터 샘플링/보정 한계**: 
    - 최대 분석 가능한 세그먼트에는 제한이 없으나, UI 렌더링(Flame 차트) 최적화를 위해 차트 가시성을 해치는 1ms 단위의 극초단기 이벤트보단 임계값(`perfThreshold`) 초과 데이터나 지정된 주요 Flow 위주로 확인하는 것에 특화되어 있습니다.
    - 렌더링 한계: 10만 개 이상의 세그먼트 발생 시 브라우저 메모리 부하가 있을 수 있어, `Bottlenecks` 리스트 뷰는 지연 시간이 긴 상위 50개 항목 위주로 우선 제공하도록 구현되어 있습니다(`slice(0, 50)`).
- **Time Parsing 민감도**: 
    - 타임스탬프 파싱이 불가능한(`extractTimestamp`가 null을 반환) 비표준 로그 줄의 경우 분석 대상(MatchedLog)에서 누락됩니다.
- **AI Agent 참조용 노트 (개발/디버그 시 주의점)**:
    - **Original Line vs Filtered Line**: Raw View 기능이나 Jump To 기능과 연동될 때, `startLine`/`endLine`(현재 뷰 기준)과 `originalStartLine`/`originalEndLine`(전체 파일 기준)의 맵핑을 혼동하지 않도록 워커 처리(`LogProcessor.worker.ts`)에서 정확한 인덱스 반환 여부가 항상 보장되어야 합니다. (이와 관련하여 UI 헤더 텍스트 표시 시 `filteredIndex` 등 관련 Prop 처리에 유의할 것)
    - **비동기 상태 관리**: 성능 분석 결과(`perfAnalysisResult`)는 메인 스레드에 비동기로 도달하므로, `useEffect` 의존성 배열에서 `currentConfig`와 워커 최신화 상태를 잘 싱크해 주어야 과거 설정으로 분석되는 버그를 막을 수 있습니다.

---

## 📌 주요 단축키 요약
- `Ctrl + \``: 설정 패널 토글
- `Ctrl + B`: 북마크 목록 보기
- `Space`: 북마크 토글
- `F3 / F4`: 이전/다음 북마크 이동
- `Ctrl + Shift + X`: 로그 클리어
- `Shift + Wheel / Arrow`: 스크롤 동기화 (듀얼 뷰 모드)
- `Ctrl + Arrow Left/Right`: 왼쪽/오른쪽 패인 포커스 전환
- `Ctrl + / -`: 화면 확대/축소
- `Ctrl + [` : font size 축소
- `Ctrl + ]` : font size 확대
- `Ctrl + Shift [` : Configuration영역 width 축소
- `Ctrl + Shift ]` : Configuration영역 width 확대
