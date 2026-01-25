# 작업 완료 보고: Capability Schema 기반 동적 커맨드 폼

## 1. 개요
ST Lab의 Command Executor에 **Capability Schema 기반 동적 입력 폼(Smart Form)**을 구현했습니다. 이제 사용자는 복잡한 JSON 배열을 직접 작성하지 않고, 자동으로 생성된 드롭다운이나 입력 필드를 통해 직관적으로 커맨드 인자를 설정할 수 있습니다.

## 2. 주요 구현 사항

### 2.1 Smart Form (동적 UI)
*   **Enum 지원**: Capability Schema에 `enum`이 정의된 경우, **드롭다운 메뉴(<select>)**가 자동으로 생성되어 유효한 값만 선택할 수 있습니다.
*   **타입별 필드**:
    *   `integer`, `number`: 숫자 입력 필드 (`Min`/`Max` 제약 조건 자동 적용).
    *   `string`: 일반 텍스트 입력 필드.
*   **자동 초기화**: 커맨드 선택 시, 스키마의 기본값(Enum의 첫 번째 값, 숫자의 Min 값 등)으로 인자가 자동 초기화됩니다.

### 2.2 하이브리드 입력 모드
*   **Smart Form 모드**: 일반적인 사용자를 위한 GUI 기반 입력.
*   **Raw JSON 모드**: 고급 사용자를 위해 기존의 JSON 직접 편집 기능도 유지(토글 가능).
*   **양방향 동기화**: Smart Form에서 값을 변경하면 내부적으로 `argsInput`(JSON)이 자동으로 업데이트되어, 실행 시 올바른 포맷으로 전송됩니다.

### 2.3 안정성 확보
*   실수로 누락되었던 **Capability Definition Fetch 로직**을 복구하여, 커맨드 목록 및 스키마 정보를 정상적으로 가져오도록 수정했습니다.
*   초기화 로직을 `useEffect`로 분리하여 디바이스/커맨드 변경 시 상태 꼬임을 방지했습니다.

## 3. 사용 가이드
1.  ST Lab > Device 선택 > Command Interface로 이동.
2.  **Arguments** 섹션 상단의 `Smart Form` / `Raw JSON` 버튼으로 모드 전환.
3.  `Smart Form` 모드에서 인자 입력 후 **Execute Command** 실행.

## 4. 향후 계획
*   현재는 1-depth 인자만 지원합니다. Object 타입 등 복잡한 중첩 구조에 대한 Smart Form 지원을 단계적으로 확장할 수 있습니다.
