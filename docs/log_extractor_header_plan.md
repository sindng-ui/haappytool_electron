# 🎯 Log Extractor 헤더 고도화 계획서

형님, `LogExtractor`는 탭 시스템과 포커스 모드가 얽혀 있어 가장 난이도가 높은 녀석입니다! 하지만 우리들의 `PluginHeader`로 깔끔하게 정리해 보겠습니다. 🐧🚀

## 1. 개요
현재 `LogExtractor`는 `h-8` 높이의 탭 바를 상단에 띄워 사용하고 있습니다. 이를 다른 플러그인과 동일한 `h-16` 표준 헤더(`PluginHeader`) 체계로 편입시키되, 기존의 탭 기능과 포커스 모드(상단 숨김) 로직을 완벽하게 계승합니다.

## 2. 주요 변경 사항

### A. PluginHeader 도입
- 상단에 `PluginHeader` (h-16)를 배치합니다.
- 아이콘: `FileText` (lucide-react)
- 제목: "Log Extractor"
- 부제목: "Advanced Multi-tab Log Analyzer"
- 우측 버튼: `Archive` 아이콘을 이용한 사이드바 토글 버튼 배치.

### B. 탭 바(Tab Bar) 위치 조정
- 기존의 `h-8` 탭 바를 `PluginHeader` 바로 아래에 배치합니다.
- 포커스 모드(`isFocusMode`) 시, `PluginHeader`와 `Tab Bar`가 모두 위로 슬라이드되어 사라지도록 애니메이션 로직을 통합합니다.

### C. 레이아웃 구조 변경
- 현재 `absolute` 포지셔닝으로 겹쳐져 있는 구조를 좀 더 직관적인 `flex flex-col` 구조로 변경합니다. (포커스 모드 시에만 transform 적용)

## 3. 작업 상세

1. **Import 추가**: `PluginHeader` 및 필요한 아이콘(`FileText`, `Archive`) 임포트.
2. **헤더 영역 리팩토링**: 
   - `PluginHeader`를 `div` 컨테이너 최상단에 배치.
   - `headerElement` (탭 바)의 스타일을 조정하여 헤더 아래에 자연스럽게 붙도록 수정.
3. **포커스 모드 로직 업데이트**:
   - `isFocusMode`일 때 헤더 전체가 `-h-24` (16+8=24) 만큼 올라가도록 수정.
4. **APP_MAP.md 업데이트**: 변경 사항 기록.

형님, 이 계획대로 진행해도 될까요? "Proceed"를 눌러주시면 바로 작업 들어갑니다! 🐧💎
