# Perf Tool 상세 명세 (Antigravity 용)

이 문서는 HappyTool의 성능 분석 핵심 도구인 **Perf Tool**과 **Log Extractor의 성능 분석 기능**에 대한 기술적 로직, 명세 및 주의사항을 담고 있습니다.

---

## 🚀 1. Overview

HappyTool은 로그 데이터를 기반으로 시스템의 동작 시간과 병목 구간을 시각화하기 위해 두 가지 형태의 성능 분석 도구를 제공합니다.

1.  **Log Extractor - Analyze Performance**: 현재 열려있는 로그 뷰어의 필터링된 데이터를 실시간으로 차트화합니다.
2.  **Perf Tool**: 별도의 독립된 파일이나 대용량 로그 전체를 대상으로 PIDDiscovery(자동 PID 찾기) 및 심층 성능 분석을 수행합니다.

이 두 도구는 핵심 연산 로직(`perfAnalysis.ts`)을 공유하지만, 사용 시나리오와 데이터 처리 방식에서 차이가 있습니다.

---

## 🛠️ 2. 공통 아키텍처 및 로직 (`perfAnalysis.ts`)

모든 성능 분석의 핵심은 **`analyzePerfSegments`** 함수입니다.

### 2.1 분석 프로세스
1.  **Collection Phase**: 설정된 `LogRule`(또는 `HappyGroup`)에 매칭되는 모든 로그 라인을 타임스탬프와 함께 추출합니다.
2.  **Global Grouping (Step Segments)**: 동일한 `alias`를 가진 로그들 중 첫 번째와 마지막 로그를 연결하여 하나의 거대한 작업 단위(`type: 'step'`)를 생성합니다.
3.  **Interval Analysis (Combo Segments)**: 시간순으로 정렬된 매칭 로그들 사이의 간격(`A -> B`, `B -> C`)을 분석하여 단계별 전환 시간(`type: 'combo'`)을 생성합니다.
4.  **Lane Assignment (Flame Chart)**: 
    *   TID(Thread ID)별로 세그먼트를 그룹화합니다.
    *   동일 쓰레드 내에서 시간이 겹치는 세그먼트는 서로 다른 Lane(층)에 배치하여 시각적 간섭을 막습니다. (Greedy Packing Algorithm)

### 2.2 공통 데이터 추출 기술
*   **PID/TID 추출**: `extractLogIds` 유틸리티를 사용하여 `[PID:TID]`, `(P 123, T 456)`, 혹은 Android 표준 포맷에서 식별자를 자동으로 추출합니다.
*   **Source Metadata 추출**: `extractSourceMetadata`를 사용하여 `FileName.cs: FunctionName> ` 형태의 로그에서 파일명과 함수명을 분리해 냅니다.

---

## 🎯 3. Perf Tool vs. Log Extractor 분석 차이점

| 항목 | Log Extractor (Analyze Performance) | Perf Tool (Standalone) |
| :--- | :--- | :--- |
| **분석 대상** | 현재 탭에 **필터링되어 보이는 로그** | **원본 로그 파일 전체** 또는 대용량 데이터 |
| **트리거 시점** | 사용자가 번개 아이콘 클릭 시 | 사용자가 `Run Analysis` 버튼 클릭 시 |
| **PID Discovery** | 불필요 (이미 필터링된 데이터 사용) | **핵심 기능**. Tag로 검색하여 관련 PID 리스트를 제안함 |
| **데이터 범위** | 실시간 유입되는 윈도우 내 데이터 위주 | 파일 전체에 걸친 통계 및 장기 흐름 분석 |
| **UI 통합** | 로그 뷰어 하단/전체화면 대시보드 | 전용 분석 화면 및 대시보드 결합 |

---

## 📝 4. 구현 및 유지보수 시 주의사항 (Antigravity AI 필독)

### 4.1 인덱스 매핑 (Original vs. Filtered)
*   분석된 세그먼트에서 "원본 로그 보기" 기능을 수행할 때, `startLine`/`endLine`(분석 시점의 인덱스)과 `originalStartLine`(원본 파일의 실제 인덱스)을 철저히 구분해야 합니다.
*   Log Extractor는 필터링된 가상 인덱스를 다루므로 매핑 오류가 발생하기 쉽습니다.

### 4.2 성능 임계값 (Threshold) 관리
*   임계값(`perfThreshold`)을 초과한 세그먼트는 시각적으로 'Fail' 상태가 되며 `Bottlenecks` 리스트에 우선 노출됩니다.
*   `DangerThresholds` 설정을 통해 시간별로 정교한 색상 단계(Slow, Very Slow, Critical)를 지정할 수 있도록 구현되어야 합니다.

### 4.3 렌더링 최적화
*   세그먼트가 수만 개를 넘을 경우 Flame Chart의 DOM 요소가 너무 많아질 수 있습니다. 
*   가시 영역 밖의 세그먼트는 렌더링하지 않거나, 대시보드 내에서의 가상화 로직을 고려해야 합니다.

---

## ⚠️ 5. 한계점 및 개선 방향

1.  **타임스탬프 의존성**: 로그 라인에 타임스탬프가 없거나 `extractTimestamp`가 파싱하지 못하는 특이 포맷의 경우 분석에서 완전히 제외됩니다.
2.  **로그 유실 대응**: 실시간 로깅 중 로그 유실(Drop)이 발생하면 `A -> B` 간격이 비정상적으로 길게 측정될 수 있습니다. 이를 감지하는 로직(Gap Detection)이 필요합니다.
3.  **메모리 부하**: 100MB 이상의 거대한 로그를 분석할 때 브라우저 메인 스레드가 멈추는 것을 방지하기 위해, Perf Tool과 Log Extractor 모두 **Web Worker**(`PerfTool.worker.ts`, `LogProcessor.worker.ts`)에서 분석을 수행하도록 구현되어 있습니다. 이를 통해 대용량 데이터 처리 중에도 UI의 반응성을 유지합니다.

---

**작성일**: 2026-02-21  
**상태**: 최신화 완료 (Antigravity AI 보강)
