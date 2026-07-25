# Block Test 로그 저장 폴더 열기 버튼 추가 구현 계획서

형님, **Block Test** 플러그인의 `log start block`에 의해 생성된 로그들이 저장되는 폴더를 바로 열어볼 수 있도록, **Delete Pipeline 버튼 바로 오른쪽**에 **로그 저장 폴더 열기 아이콘 진입점**을 추가하는 계획서입니다.

---

## ⚠️ 안내 사항 (500줄 경고)

> [!WARNING]
> 현재 `components/BlockTest/hooks/useBlockTest.ts` 파일이 **924줄**로 500줄 상한선을 초과하고 있습니다.
> 이번 작업에서는 형님의 요청 기능을 부작용(Side-effect) 없이 최소한의 코드로 안전하게 추가한 후, 추후 `useBlockTest.ts`를 작은 모듈형 커스텀 훅들(예: `usePipelineExecutor`, `useScenarioExecutor` 등)로 분리하는 리팩토링 계획을 수립하여 보고드리겠습니다.

---

## 🛠️ 주요 변경 사항

### 1. Backend Socket Handler ([server/index.cjs](file:///k:/Antigravity_Projects/gitbase/happytool_electron/server/index.cjs))
- `open_block_test_dir` 소켓 이벤트 생성:
  - 로그 파일이 저장되는 `BLOCK_TEST_DIR` (사용자 Data 폴더 내 `BlockTest` 디렉터리) 존재 여부를 체크하고, 없으면 생성.
  - Electron `shell.openPath` 또는 운영체제 탐색기(`explorer` / `open`) 명령어로 해당 디렉터리를 엽니다.

### 2. Custom Hook ([components/BlockTest/hooks/useBlockTest.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/BlockTest/hooks/useBlockTest.ts))
- `openLogFolder` 함수 추가:
  - `socketRef.current?.emit('open_block_test_dir')` 호출.
  - `useBlockTest` 리턴 객체에 `openLogFolder` 포함.

### 3. UI Component ([components/BlockTest/index.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/BlockTest/index.tsx))
- 파이프라인 관리 액션 버튼 영역의 **Delete Pipeline (`Lucide.Trash2`) 버튼 바로 오른쪽**에 **로그 폴더 열기 버튼 (`Lucide.FolderOpen`)** 추가:
  - 클릭 이벤트: `openLogFolder`
  - 툴팁: `Open Log Storage Folder (로그 저장 폴더 열기)`
  - 스타일: 기존 헤더 액션 버튼들과 조화로운 Glassmorphism / Accent hover 효과 적용.

### 4. 문서 업데이트 ([APP_MAP.md](file:///k:/Antigravity_Projects/gitbase/happytool_electron/important/APP_MAP.md))
- Block Test UI 섹션에 로그 저장 폴더 열기 아이콘 버튼 추가 내역 업데이트.

---

## 🧪 검증 계획 (Verification Plan)

1. **자동/수동 동작 확인**
   - Delete Pipeline 버튼 바로 오른쪽에 폴더 아이콘 버튼이 위치하는지 UI 레이아웃 확인.
   - 버튼 클릭 시 실제 윈도우 탐색기에서 로그 저장 폴더(`BlockTest`)가 즉시 열리는지 수동 검증.
   - `log start block` 실행 시 생성되는 로그 파일이 해당 폴더에 제대로 저장되는지 연동 확인.

2. **리그레션 테스트**
   - 기존 파이프라인 생성, 이름 변경, 삭제 기능에 영향을 주지 않는지 확인.

---

## 형님, 아래 Proceed 버튼을 누르시거나 승인해 주시면 신나게 구현을 진행하겠습니다! 🐧

[Proceed (구현 시작)](#proceed)
