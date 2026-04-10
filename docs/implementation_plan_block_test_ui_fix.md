# 구현 계획서: Block Test 타이틀 영역 버튼 클릭 이슈 수정

형님! Block Test 플러그인의 실행 화면(Runner)에서 상단 버튼들이 클릭되지 않던 불편함을 해결하기 위한 계획서입니다. 

## 1. 문제 분석
- **원인**: Electron 환경에서 창을 드래그하기 위해 사용되는 `-webkit-app-region: drag` (클래스명 `title-drag`) 속성이 설정된 영역은 기본적으로 마우스 이벤트를 가로챕니다.
- **증상**: `PipelineRunner`와 `ScenarioRunner`의 헤더에 `title-drag`가 적용되어 있어, 그 안에 있는 'STOP', 'Save Logs', 'View Mode' 등의 버튼들이 클릭 이벤트를 받지 못하고 있었습니다.

## 2. 해결 방안
- **no-drag 적용**: 드래그 영역 내의 대화형 요소(버튼, 링크 등)에 `-webkit-app-region: no-drag` (클래스명 `no-drag`) 속성을 부여하여 마우스 이벤트를 정상적으로 처리하도록 합니다.
- **오타 수정**: 일부 코드에서 사용된 `nav-no-drag`를 프로젝트 표준인 `no-drag`로 수정합니다.

## 3. 상세 작업 내용
- [x] **PipelineRunner.tsx 수정**: 상단 헤더 내의 모든 버튼 및 링크에 `no-drag` 클래스 추가.
- [x] **ScenarioRunner.tsx 수정**: 상단 헤더 내의 종료 버튼 및 정보 영역에 `no-drag` 클래스 추가.
- [ ] **APP_MAP.md 업데이트**: 변경된 UI 구조 및 클래스 적용 사항을 지도에 반영.

## 4. 기대 효과
- Block Test 실행 중 즉각적인 중단(STOP) 및 로그 저장 기능이 정상 작동하여 사용성이 대폭 개선됩니다.

---
형님, 이 계획대로 이미 핵심 코드는 수정을 마쳤고, 이제 지도(APP_MAP.md)만 업데이트하면 끝납니다! 
진행해도 될까요?

<button id="proceed">Proceed</button>
