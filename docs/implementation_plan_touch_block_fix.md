# BlockTest Touch Block 복구 및 이전 설정 자동 병합 구현 계획

형님! 구버전 앱이 설치되어 있던 회사 PC에서 최신 앱 설치 후 BlockTest의 **Touch Block**이 보이지 않는 원인 분석과 이를 근본적으로 해결하기 위한 계획입니다. 🐧⚡

---

## 1. 원인 분석 🔍

1. **localStorage 구버전 데이터 선점 이슈**:
   - 이전 버전 앱에서 BlockTest를 실행했던 PC의 `localStorage`에는 `'happytool_blocks'` 키로 구버전 블록 배열이 저장되어 있습니다. (당시에는 `special_touch` 특수 블록이 존재하지 않았음)
2. **useState 초기화 병합 누락**:
   - `components/BlockTest/hooks/useBlockTest.ts` (L16-26)의 초기화 로직에서 `localStorage.getItem('happytool_blocks')`에 값이 존재하면 `JSON.parse(saved)` 결과를 **그대로 리턴**합니다.
   - 즉, 코드상에 최신 `SPECIAL_BLOCKS` (`special_touch` 등)가 새로 추가되었더라도, `localStorage`에 기존 데이터가 남아있으면 병합되지 못하고 구버전 데이터만 노출되는 현상이 발생했습니다.

---

## 2. 해결 방안 🛠️

### A. 형님 회사 PC에서 즉시 보이게 하는 방법 (0초 조치법) ⚡
1. HappyTool 앱 실행 상태에서 **`F12`** 키를 눌러 개발자 도구를 엽니다.
2. **Console** 탭으로 이동하여 다음 커맨드를 입력하고 엔터를 누릅니다:
   ```javascript
   localStorage.removeItem('happytool_blocks')
   ```
3. **`Ctrl + R`** 로 앱을 새로고침하면 `Touch Block`이 깨끗하게 복구되어 화면에 나타납니다.

---

### B. 앱 코드 개선 (향후 구버전 설치 PC에서도 자동 복구되도록 근본 조치) 🛡️

#### [MODIFY] [useBlockTest.ts](file:///K:/Antigravity_Projects/gitbase/happytool_electron/components/BlockTest/hooks/useBlockTest.ts)
- `useState` 초기화 함수 내부에서 `localStorage` 데이터를 읽을 때, 단순 반환이 아닌 **`PREDEFINED_BLOCKS` 및 `SPECIAL_BLOCKS` 맵 기반 안전 병합(Merge)** 로직을 이식합니다.
- 기존 사용자가 커스텀 생성한 블록(`type === 'custom'`)과 기존 수정 내역은 100% 보존하면서, 누락된 최신 특수 블록(`special_touch`, `special_wait_image` 등)이 자동으로 추가 배치됩니다.

---

## 3. 🚨 500줄 초과 감지 및 리팩토링 제안 👮

> [!WARNING]
> `components/BlockTest/hooks/useBlockTest.ts` 파일이 현재 **960줄**로, 형님의 500줄 초과 규칙을 초과하고 있습니다!
> 
> **리팩토링 계획**:
> 1. 이번 Touch Block 병합 가드 작업을 안전하게 적용한 후,
> 2. `useBlockTest.ts`를 다음과 같이 마이크로 훅으로 분리하는 리팩토링을 제안합니다:
>    - `useBlockStorage.ts`: 블록, 파이프라인, 시나리오의 저장/로드 및 백엔드 socket 릴레이 연동 (약 200줄)
>    - `usePipelineExecution.ts`: 파이프라인/시나리오 실행 엔진, 렌더링 타이머, 리포트 생성 (약 450줄)
>    - `useBlockTest.ts`: 위 훅들을 조합하는 초경량 메인 훅 (약 150줄)

---

## 4. Verification Plan (검증 계획) 🧪

### Automated Verification
- `npm test`를 실행하여 기존 BlockTest 관련 단위 테스트 및 컴포넌트 동작 무결성 확인.

### Manual Verification
- `localStorage`에 구버전 블록 데이터(`[{ id: 'connect_block' }, { id: 'special_sleep' }]`)를 강제로 주입한 후, `useBlockTest` 마운트 시 `special_touch`가 자동으로 목록에 합쳐져 렌더링되는지 확인.
