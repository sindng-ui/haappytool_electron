# NupkgSigner 단위 테스트(UT) 구현 계획

형님! NupkgSigner 플러그인이 단단하게 돌아갈 수 있도록 테스트 코드를 쫙 짜보겠습니다. 특히 복잡한 ZIP 조작 로직을 별도 유틸리티로 빼서 테스트하기 좋게 리팩토링도 병행할 예정입니다. 🐧🧪

## Proposed Changes

### 1. 로직 리팩토링 (Logic Extraction)
테스트를 쉽게 하기 위해 `Step4_Repackage.tsx`에 뭉쳐있던 로직을 유틸리티로 분리합니다.

#### [NEW] [nupkgUtils.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/NupkgSigner/utils/nupkgUtils.ts)
- `repackageNupkg(originalZip, soFiles)`: ZIP 파일을 순회하며 서명본을 넣거나 특정 폴더를 제외하는 핵심 순수 함수.

#### [MODIFY] [Step4_Repackage.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/NupkgSigner/Step4_Repackage.tsx)
- 내부 로직을 `repackageNupkg` 유틸리티 호출로 변경.

---

### 2. 단위 테스트 추가 (Unit Tests)

#### [NEW] [nupkgUtils.test.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/test/components/NupkgSigner/nupkgUtils.test.ts)
- `.so` 파일 교체 로직 검증.
- 체크 해제 시 해당 아키텍처 폴더(`runtimes/RID/`)가 통째로 제외되는지 검증 (핵심 요구사항).
- 원본 메타데이터나 다른 파일들이 유지되는지 검증.

#### [NEW] [NupkgSigner.test.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/test/components/NupkgSigner/NupkgSigner.test.tsx)
- 마법사 단계 전환 (Step 1 -> Step 2) 검증.
- 파일 드롭 시 상태 업데이트 및 JSZip 로딩 확인.
- 에러 발생 시 UI 표시 검증.

---

### 3. 인프라 업데이트
#### [MODIFY] [APP_MAP.md](file:///k:/Antigravity_Projects/gitbase/happytool_electron/important/APP_MAP.md)
- 새로 추가된 유틸리티 및 테스트 파일 정보 업데이트.

## Verification Plan

### Automated Tests
- `npx vitest k:/Antigravity_Projects/gitbase/happytool_electron/test/components/NupkgSigner` 실행하여 모든 테스트 패스 확인. 🐧✅

### Manual Verification
- 실제 앱 상에서 리팩토링 후에도 기존 로직(패키징, 제외)이 정상 작동하는지 확인.
