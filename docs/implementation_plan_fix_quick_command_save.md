# Implementation Plan - Quick Command 저장 기능 수정 🛠️

형님! Quick Command에서 새로운 커맨드를 추가할 때 저장이 안 되는 문제를 분석했습니다. 
원인은 크게 두 가지로 보입니다:
1. `htmlToTokens` 함수에서 `innerText`를 사용하여 내용을 읽어오는데, 렌더링되지 않은 엘리먼트에서는 `innerText`가 빈 값을 반환할 수 있어 상태 업데이트가 씹히는 현상.
2. React의 비동기 상태 업데이트 특성상, "저장" 버튼 클릭 시점에 최신 입력값이 아직 상태에 반영되지 않았을 가능성.

이를 해결하기 위해 다음과 같이 수정하겠습니다!

## 1. 수정 사항

### A. `htmlToTokens` 유틸리티 개선
- `innerText` 대신 더 신뢰할 수 있는 `textContent`를 우선 사용하도록 변경합니다.
- 렌더링되지 않은 엘리먼트에서도 정확한 텍스트를 추출할 수 있도록 보장합니다.

### B. `handleSave` 로직 강화
- `editData` 상태에만 의존하지 않고, `editorRef`를 통해 DOM에서 직접 최신 커맨드 문자열을 읽어와 저장하도록 변경합니다.
- 저장 시 이름과 커맨드가 비어있는지 다시 한번 검증합니다.

### C. `localStorage` 로딩 안정화
- `JSON.parse` 시 발생할 수 있는 잠재적 오류를 방지하기 위해 `try-catch` 안전장치를 추가합니다.

## 2. 세부 작업 단계

1. `components/LogViewer/ConfigSections/QuickCommandSection.tsx` 파일 수정
   - `htmlToTokens` 함수 수정
   - `handleSave` 함수 수정
   - `useState` 초기화 로직 보완

2. 테스트 및 검증
   - 새로운 커맨드 입력 후 저장 버튼 클릭 시 목록에 정상적으로 추가되는지 확인
   - 기존 커맨드 수정 후 저장 시 정상 반영되는지 확인

형님, 이대로 진행할까요? 🐧🚀
