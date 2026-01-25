# Task: Capability Schema 기반 동적 커맨드 입력 폼 구현

ST Lab 플러그인의 Command Executor를 개선하여, 사용자가 JSON을 직접 작성하는 대신 Capability 정의(Schema)에 따라 자동으로 생성된 UI를 통해 인자(Arguments)를 입력할 수 있도록 합니다.

## 세부 작업 내용

1.  **CommandInterface.tsx 동적 UI 구현**
    *   선택된 커맨드의 `arguments` 스키마 분석.
    *   `enum`이 있는 경우: 드롭다운(Select) 메뉴 표시.
    *   `integer`, `number` 타입: 숫자 입력 필드 및 Min/Max 제한 적용.
    *   `string` 타입: 텍스트 입력 필드.
    *   복잡한 타입: JSON 편집기(Textarea) 유지.

2.  **상태 관리 로직 고도화**
    *   커맨드 변경 시 인자 배열(`argsValue`) 초기화.
    *   UI 입력값과 JSON 문자열(`argsInput`) 상호 동기화 (양방향 지원).

3.  **UI/UX 정교화**
    *   인자별 이름 및 설명 표시.
    *   필수/선택 사항 표시.
    *   입력 필드 스타일 앱 전체 테마와 일치.

4.  **검증**
    *   다양한 기기 커맨드(예: `execute`, `setLevel`, `setColor` 등)에 대해 올바른 UI가 생성되는지 확인.
