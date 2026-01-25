# 기능 구현 계획 - Capability Schema 기반 동적 커맨드 폼

## 1. 분석 및 설계
*   **데이터 구조**: `STCommand` 객체 내부의 `arguments` 배열을 순회하며 각 인자의 `schema` 정보를 활용.
*   **UI 매핑 규칙**:
    *   `enum` 존재 -> `<select>`
    *   `type: integer | number` -> `<input type="number">` (with min/max)
    *   `type: string` -> `<input type="text">`
    *   기타 -> `<textarea>` (JSON)

## 2. 상세 구현 단계

### 1단계: Argument 상태 구조 변경
*   `argsInput` (문자열 JSON) 외에 `argValues` (배열) 상태 추가.
*   커맨드 선택 시 `argValues`를 스키마에 정의된 기본값 또는 빈 값으로 초기화.

### 2단계: 동적 입력 컴포넌트 (`ArgumentField`) 구현
*   개별 인자를 위한 하위 컴포넌트 또는 렌더링 함수 생성.
*   스키마 타입별로 적절한 HTML 요소 렌더링.

### 3단계: 양방향 동기화 및 Execute 로직 수정
*   동적 폼 입력 시 `argsInput` 문자열 자동 업데이트.
*   `argsInput` 수동 수정 시 (고급 사용자) 동적 폼 상태 반영 노력 (선택 사항).
*   최종 `handleExecute`에서 스키마 기반 검증 로직 추가 고려.

### 4단계: UI 폴리싱
*   인자 이름(label) 가독성 향상.
*   Optional 인자에 대한 시각적 표시.

## 3. 예외 케이스 처리
*   커맨드에 인자가 없는 경우 처리.
*   스키마 정보가 불완전한 경우 Fallback 처리 (기존 Textarea 노출).
