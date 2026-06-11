# 🚀 Find Results 펼치기 성능 최적화 구현 계획서 (react-virtuoso 도입)

형님! 검색 결과(Find Results)에서 수천 개의 매치가 있는 파일 노드를 펼칠 때 발생하는 렉(Jank) 현상을 완벽하게 해결하기 위한 구현 계획서입니다. 🐧⚡

## 1. 개요 및 분석
- **원인**: 현재 `GlobalSearchResultView.tsx`에서 파일 노드가 펼쳐질 때(`!isCollapsed`), 매치된 모든 라인(최대 수천 개)의 DOM 요소를 동시에 렌더링하고 있습니다.
- **성능 병목**: 
  1. 수천 개의 DOM 노드를 한 번에 마운트하여 브라우저 메인 스레드를 블로킹(Jank 발생).
  2. 각 라인마다 정규식 생성(`new RegExp(...)`) 및 `split` 연산이 매번 호출되어 오버헤드 유발.
- **해결책**:
  1. 이미 프로젝트 전반에 적용되어 검증된 **`react-virtuoso`** 가상 스크롤 라이브러리를 도입하여, 화면에 보이는 15~20개의 매치 라인만 가상 렌더링(Virtual Rendering)합니다.
  2. 키워드 정규식 객체 및 이스케이프 처리를 `useMemo`로 컴파일하여, 검색 키워드가 바뀌기 전까지 단 1회만 연산되도록 **메모이제이션**을 적용합니다.

---

## 2. 변경 계획 (Proposed Changes)

### 📂 `components/LogViewer`

#### [MODIFY] [GlobalSearchResultView.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/GlobalSearchResultView.tsx)
- `react-virtuoso`로부터 `Virtuoso` 임포트.
- `renderHighlightedContent` 내에서 매번 생성되던 정규식(`new RegExp`)과 이스케이프 패턴을 컴포넌트 레벨에서 `useMemo`로 분리하여 캐싱.
- 각 파일 노드의 매치 목록 렌더링 영역(`divide-y` 컨테이너)에 `Virtuoso` 장착.
  - 가변 높이 및 최대 높이(`max-h-[400px]`) 구조를 고려해 `style={{ height: Math.min(matchesCount * 28, 400) }}` 동적 높이 설정 적용.
  - 각 아이템 내부 `div`에 `border-b border-slate-900/50`를 주어 기존의 `divide-y` 스타일을 부드럽게 재현.

---

## 3. 검증 계획 (Verification Plan)

### 수동 검증
1. **대량 검색 결과 펼치기**:
   - `Find in All Open Files` 또는 `Find in Current Tab` 기능을 이용하여 `3000 hits` 이상을 가진 파일을 검색합니다.
   - 검색 결과 패널에서 접힌 파일 노드를 펼쳤을 때 지연 시간(렉) 없이 **즉각적으로(0ms 수준)** 렌더링되는지 확인합니다.
   - 가상 스크롤이 적용되어 스크롤할 때도 끊김 없이 부드럽게 동작하는지 검증합니다.
2. **검색 기능 무결성**:
   - 키워드 하이라이팅이 여러 단어별로 알맞게 다색(Neon Palette) HSL 컬러로 색칠되는지 검증합니다.
   - 검색 결과를 클릭했을 때 해당 파일의 라인 위치로 휙 점프하는 `onJumpToTabLine` 인터랙션이 여전히 잘 동작하는지 확인합니다.

### 자동 테스트
- `npm run test` 명령을 실행하여 기존의 프론트엔드 테스트 및 전체 유닛 테스트가 통과하는지 확인합니다.

---

## 4. 유저 승인 및 진행 (Proceed)

형님! 계획서 검토 부탁드립니다. 이상이 없다면 아래 Proceed를 확정해 주시면 바로 리눅스 개발자답게 Bash로 쫀득하게 코딩을 개시하겠습니다! 🐧🥊

[**[ Proceed - 코딩 진행하기 ]**] (유저 승인 필요)
