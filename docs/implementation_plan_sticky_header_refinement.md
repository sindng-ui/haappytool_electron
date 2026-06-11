# 🏁 Find Results Sticky Header 정밀 개선 구현 계획서

형님! 검색 결과 목록 스크롤 시 파일명 헤더가 자석처럼 상단에 고정되지 않고 밀려 올라가던 현상을 완전히 잡기 위한 정밀 튜닝 계획서입니다. 🐧⚡

---

## 1. 문제 분석 (Problem Analysis)

- **가상 스크롤 마진 간섭**:
  - 현재 [GlobalSearchResultView.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/GlobalSearchResultView.tsx)의 파일 헤더와 마지막 매치 아이템의 가장 바깥쪽 엘리먼트에 `mb-3` 마진이 주입되어 있습니다.
  - 가상 스크롤러(`react-virtuoso`) 내부 아이템들의 외곽 마진은 스크롤 높이(Offset) 측정 공식에 오차를 일으키고, 브라우저의 네이티브 `position: sticky` 배치 시점에 오프셋이 뒤틀려 헤더가 뷰포트 밖으로 밀리는 부작용을 낳습니다.
- **쌓임 맥락 (z-index) 보장 부족**:
  - 가상 스크롤러에 의해 `position: sticky`가 주입되는 래퍼 엘리먼트 내부에 명시적인 `relative z-index` 구조가 잡혀있지 않아, 뒤따라 올라오는 일반 매치 로그 라인들이 헤더를 덮어 씌우는 현상이 발생할 수 있습니다.

---

## 2. 해결 제안 (Proposed Solutions)

- **마진 완전 소탕 및 투명 패딩화 (`pb-3 bg-transparent`)**:
  - 개별 아이템 래퍼에서 `mb-3` 마진을 100% 제거합니다.
  - 대신 각 아이템을 담는 최외곽 투명 래퍼(`bg-transparent`)를 씌우고 아래쪽에 `pb-3` 패딩을 적용하여, 가상 높이 측정 오차를 원천 봉쇄하면서도 기존의 깔끔한 카드 분리 여백 디자인은 1px 오차 없이 유지합니다.
- **헤더 쌓임 맥락 강화 (`relative z-10`)**:
  - 파일 노드 헤더가 렌더링될 때 내부 컨테이너에 `relative z-10`을 부여하여, 일반 매치 라인들(`bg-slate-900/20`)이 스크롤될 때 헤더 뒷쪽으로 부드럽게 감춰지도록 보장합니다.

---

## 3. 변경 예정 파일 (Proposed Changes)

### [[Log Viewer UI Architecture]]

#### [MODIFY] [GlobalSearchResultView.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/GlobalSearchResultView.tsx)
- 헤더와 매치 아이템 렌더링 영역의 마진 구조를 투명 래퍼 패딩 구조로 개조합니다.

---

## 4. 검증 계획 (Verification Plan)

### 자동화 테스트 (Automated Tests)
- `wsl npm run test` 명령을 수행하여 기존 405개 유닛 테스트의 회귀 오류(Regression) 유무를 정밀 스캔합니다.

### 수동 검증 (Manual Verification)
- `npm run electron:dev` 환경에서 대량의 파일 검색 결과를 띄운 뒤, 스크롤을 끝까지 내렸을 때:
  1. 현재 뷰포트에 걸쳐 있는 파일명 헤더가 스크롤바 상단에 단단히 고정(Sticky)되어 있는지 확인합니다.
  2. 다음 파일 헤더가 밀고 올라올 때 이전 헤더와 자연스럽게 전환(밀어내기)되는지 확인합니다.
  3. 스크롤바가 이중으로 생기지 않고 매끄럽게 동작하는지 눈으로 검증합니다.

---

형님! 계획을 승인해 주시면 (Proceed를 말씀해 주시면) 즉시 쫀득하게 고치러 가겠습니다! 🥊🐧
