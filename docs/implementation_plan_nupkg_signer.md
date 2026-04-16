# NupkgSigner 플러그인 구현 계획 📦✨

형님! .nupkg 파일을 요리조리 주물러서 .so 파일을 서명하고 다시 포장하는 멋진 플러그인을 만들어보겠습니다. 🐧🚀

## User Review Required

> [!IMPORTANT]
> **라이브러리 추가**: ZIP 파일 처리를 위해 `jszip` 라이브러리를 추가로 설치해야 합니다. 브라우저/렌더러 환경에서 성능과 호환성이 가장 검증된 도구입니다.

> [!NOTE]
> **대용량 처리**: Nupkg 파일이 매우 클 경우를 대비하여, `JSZip` 처리는 가능한 비동기적으로 수행하며 UI가 멈추지 않도록 애니메이션과 프로그레스 바를 적극 활용하겠습니다.

## Proposed Changes

### 1. 전역 설정 및 타입 정의
플러그인 시스템에 새로운 도구를 등록합니다.

#### [MODIFY] [types.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/types.ts)
- `ToolId` 열거형에 `NUPKG_SIGNER` 추가.

#### [MODIFY] [wrappers.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/core/wrappers.ts)
- `NupkgSignerPlugin` 래퍼 정의 및 레이지 로딩 설정.

#### [MODIFY] [registry.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/registry.ts)
- `ALL_PLUGINS` 배열에 새로운 플러그인 추가.

---

### 2. NupkgSigner 컴포넌트 구현
`components/NupkgSigner` 디렉토리에 깔끔하게 분리하여 구현합니다.

#### [NEW] `components/NupkgSigner/index.tsx`
- 전체 5단계 상태 관리 (Original File, Extracted Files, Signed File Map, Current Step).
- 최종 파일명 생성 로직: `${originalName}_signed.nupkg`.
- 단계별 전환 애니메이션 (`framer-motion` 활용).

#### [NEW] `components/NupkgSigner/Step1_SourceUpload.tsx`
- 메인 드롭존 구현. `.nupkg` 파일 필터링.

#### [NEW] `components/NupkgSigner/Step2_3_FileList.tsx`
- 추출된 `.so` 파일 목록 표시.
- 각 항목별 '원본 다운로드' 및 '서명본 업로드' 인터페이스 통합.

#### [NEW] `components/NupkgSigner/Step4_Repackage.tsx`
- `JSZip`을 사용하여 서명본으로 교체 후 새로운 ZIP 생성 로직 및 진행률 표시.

#### [NEW] `components/NupkgSigner/Step5_FinalDownload.tsx`
- 최종 생성된 `.nupkg` 다운로드 제공 및 초기화 버튼.

---

### 3. 시스템 업데이트

#### [MODIFY] [APP_MAP.md](file:///k:/Antigravity_Projects/gitbase/happytool_electron/important/APP_MAP.md)
- 새로운 플러그인 정보 및 인터페이스 규격 업데이트.

---

## Open Questions

- **형님, 파일 저장 방식**: Electron의 `showSaveDialog`를 사용해서 형님이 직접 저장 위치를 선택할 수 있게 하겠습니다. 이때 파일명은 자동으로 `${originalName}_signed.nupkg`로 제안되도록 구현하겠습니다!
- **so 파일 경로**: 별도 말씀 없으셨으니 `runtimes/` 폴더 아래의 모든 `.so`를 탐색하는 것으로 진행하겠습니다.

## Verification Plan

### Automated Tests
- `vitest`를 사용하여 ZIP 추출 및 특정 경로 파일 교체 로직에 대한 단위 테스트 작성.

### Manual Verification
- 실제 `.nupkg` 파일을 드롭하여 `.so` 파일들이 정상적으로 리스트업되는지 확인.
- 임의의 파일을 서명본으로 업로드 후 '압축' 버튼을 눌러 결과물이 정상적인 ZIP 구조를 유지하는지 확인.
- 다시 압축 해제하여 파일이 정상적으로 교체되었는지 검증.
