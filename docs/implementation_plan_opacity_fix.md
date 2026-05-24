# [구현 계획서] Log Level Colors Opacity % 실시간 연동 버그 완벽 수정 🐧⚡

형님! 모달(Log Control Center) 내에서 `Log Level Colors` 의 `Opacity %` 슬라이더를 열심히 조절해보아도 메인 로그 뷰어의 은은한 네온 배경색 투명도가 즉각 반응하지 않았던 미스터리한 문제를 분석하고, 60fps 무결성 성능을 보장하며 0ms 즉각 반응하도록 보수하는 초특급 계획서입니다!

---

## 🔎 원인 분석 및 해결 전략

### 1. 레벨 색상 대소문자 불일치 가능성 완전 봉쇄 🚫
- **원인**: 사용자가 color picker를 조작하여 색을 고르면 HTML5 스펙 상 `#ffa500`처럼 **소문자**로 반환됩니다. 그러나 기본 테마설정(`defaultLogViewPreferences`)에 하드코딩된 색상들은 `#FFA500`처럼 **대문자**입니다.
- **증상**: `HyperLogRenderer.tsx` 캔버스 드로잉 루프 내에서 `levelMatchers.some(m => m.color === lineData.levelColor)` 조건문이 대소문자 차이로 인해 `false`를 뱉어내면, 배경색 자체가 1px도 칠해지지 않는 현상이 발생합니다.
- **해결책**: 비교 시 양측 모두 소문자로 통일(`m.color.toLowerCase() === lineData.levelColor.toLowerCase()`)하여 대소문자 불일치 에러를 원천 차단합니다!

### 2. Opacity 변경 감지 2중 동기화 가드 장착 ⚡
- **원인**: `logLevelOpacity` 가 변경되어 `preferences` 자체의 참조가 바뀌더라도, Canvas 배경을 그리는 `useLayoutEffect` 의 dependency 나 `cachedLines` 갱신 트리거가 세밀하게 맞물려 있지 않아 캔버스가 다시 그려지지 않았을 수 있습니다.
- **해결책**:
  - `HyperLogRenderer.tsx` 의 텍스트/배경 렌더링을 유발하는 `useLayoutEffect` 의 종속성 배열에 `preferences` 및 `preferences.logLevelOpacity` 를 확실하게 바인딩합니다.
  - `preferences.logLevelOpacity` 가 바뀔 때 캔버스의 `render()` 가 동기적으로 0ms 즉시 호출되도록 보증합니다.

---

## 🛠️ 변경 예정 파일

### 1. `components/LogViewer/HyperLogRenderer.tsx` `[MODIFY]`
- **내용**: 
  - 549라인 부근의 레벨 색상 일치 여부 판별 시 대소문자를 무시하도록 `toLowerCase()` 가드 삽입.
  - `render` 함수의 `useCallback` 종속성 배열과 최하단 `useLayoutEffect` 종속성 배열에 `preferences?.logLevelOpacity` 및 `preferences` 연동성을 촘촘하게 추가하여 껌벅임이나 누수 없는 실시간 리렌더링 실현.

---

## 🎯 검증 계획

### 1. 수동 검증
- 모달 내에서 Info 및 Error 레벨 토글을 켠 뒤, Opacity 슬라이더를 5%에서 100%까지 드래그해보며 메인 화면의 각 로그 라인 배경색 투명도가 렉이나 프레임 드랍 없이 0ms 즉각 부드럽게 물드는지 육안 확인.
- WSL bash 환경에서 `npx tsc --noEmit`을 돌려 컴파일러 무결성 100% 확인.

---

## 💡 형님! 아래 [Proceed] 버튼을 눌러 승인해주시면 리눅스 개발자 펭귄이 즉시 빛의 속도로 코딩을 시작하겠습니다! 🐧🚀

[Proceed]
