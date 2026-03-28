# NetTraffic Analyzer - Compare View 리팩토링 계획서

## 🎯 목표 (Goal)
NetTraffic Analyzer의 Compare View를 전격 리팩토링하여, 두 통신 로그 간의 트래픽 증감(+/-), 과다 트래픽 발생 여부, 불필요한 트래픽 검출 등을 한눈에 식별할 수 있는 전용 UI와 비교 엔진을 구축합니다.

## ⚠️ 유저 리뷰 요구사항 (User Review Required)
> [!IMPORTANT]
> **형님, 코딩 전 결재 바랍니다!**
> 기존 `NetTrafficAnalyzerView.tsx` 파일이 점점 커짐에 따라, 이번 Compare 기능은 500줄 규칙을 지키고 파일 복잡도를 낮추기 위해 **독립적인 컴포넌트들(`NetTrafficCompareView.tsx` 등)로 분리**하여 개발할 계획입니다.
> 아래 계획이 마음에 드신다면 **[Proceed]** 명령을 내려주십시오! 🐧⚡

## 📋 제안하는 변경 사항 (Proposed Changes)

### 1. Diff 계산 유틸리티
- 트래픽의 증감을 계산하는 순수 비즈니스 로직을 분리합니다.
#### [NEW] `utils/netTrafficDiffUtils.ts`
- `leftResult`(Primary)와 `rightResult`(Reference)를 `templateUri` 기준으로 병합(Merge)합니다.
- 각 엔드포인트별로 `Diff(변화량)`, `증감율(%)`, `상태(NEW, REMOVED, INCREASED, DECREASED, UNCHANGED)`를 계산합니다.

### 2. Compare View 전용 컴포넌트 
#### [NEW] `components/NetTrafficAnalyzer/NetTrafficCompareView.tsx`
- Compare 탭이 활성화되었을 때 렌더링되는 최상단 컨테이너입니다.
- 결과 탭을 분리하여 `Diff Summary`, `Compare Endpoints`, `Compare UAs` 등으로 구성합니다.

#### [NEW] `components/NetTrafficAnalyzer/CompareSummary.tsx`
- 요구사항의 "요약 제공"을 담당합니다.
- 총 트래픽 증가량, 새롭게 추가된 불필요한 API 호출, 과다 호출된 API(Top Spikes) 등을 직관적인 카드 형태로 한눈에 보여줍니다.

#### [NEW] `components/NetTrafficAnalyzer/CompareEndpointTable.tsx`
- 기존 `EndpointTable` 형식을 탈피하고 **좌/우 비교에 최적화된 새로운 테이블**을 제공합니다.
- **아이템간 구분 명확화**: 행마다 `+ 크게 증가(Red)`, `- 감소(Green)`, `신규 발생(Yellow)` 등 명확한 색상 배지를 부여합니다.
- 좌/우 Hit 카운트를 병렬 스파크라인이나 양방향 Bar 차트 형식으로 시각화하여 "어느 쪽이 더 많은지" 한눈에 보이게 만듭니다.

### 3. 메인 뷰어 통합
#### [MODIFY] `components/NetTrafficAnalyzer/NetTrafficAnalyzerView.tsx`
- `activeTab === 'compare'`이고 분석이 완료되었을 때, 기존의 Single 렌더링 로직 대신 `<NetTrafficCompareView>` 컴포넌트를 마운트하도록 수정합니다.
- 기존 Single View 동작에는 전혀 영향을 주지 않으므로 리그레션(Regression)을 원천 차단합니다.

---

## 🧪 검증 계획 (Verification Plan)

### 1. TypeScript 컴파일 단위 검증
- 기존 파일들 간의 타입이 꼬이지 않는지 `npx tsc --noEmit` 명령어를 통해 타입 검증을 선행합니다.

### 2. 수동 검증 단계 (Manual Verification)
1. `npm run electron:dev` 실행
2. NetTraffic 플러그인 탭 진입
3. **Compare View** 전환 후 좌/우에 서로 다른 로그 세트 드롭
4. "Execute Analysis" 실행 시 UI 렌더링 및 다음 항목 체크:
   - [ ] 요약 탭(Summary)에서 트래픽 총 증감폭이 정상적으로 표시되는지 확인.
   - [ ] 테이블에서 각 API마다 [좌측 카운트] vs [우측 카운트] 및 [Diff 수치]가 명확하게 시각화되는지 확인.
   - [ ] 과도하게 증가한 트래픽이 붉은색 뱃지 등으로 강조되는지 확인.

---
**진행을 원하시면 Proceed 라고 답변해주세요!** 🚀
