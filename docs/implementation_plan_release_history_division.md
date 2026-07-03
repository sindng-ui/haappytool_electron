# 📅 Release History 플러그인 다중 Division 관리 구현 계획서

Release History 플러그인의 릴리즈 정보 세트를 여러 개로 분리하여 관리할 수 있도록 다중 Division 기능을 도입합니다.
사용자는 드롭다운 메뉴를 통해 Division을 편리하게 선택 및 전환할 수 있으며, 실시간으로 Division을 추가하거나 기존 Division을 삭제할 수 있습니다.

---

## User Review Required

형님! 이번 변경 사항에서 꼭 짚고 넘어가야 할 주요 설계 결정사항입니다.

> [!IMPORTANT]
> **1. 기존 데이터의 하위 호환성 유지 (마이그레이션)**
> 형님께서 이미 작성해 두신 릴리즈 히스토리 데이터가 유실되지 않도록, 기존의 단일 세트 구조(`items`, `yearConfigs`) 데이터를 감지하면 자동으로 `"Default"`라는 이름의 Division 데이터로 이식하는 안전망을 적용합니다.
> 
> **2. 데이터 내보내기/가져오기 (Export/Import) 범위**
> - **내보내기(Export)**: 현재 활성화되어 보고 있는 Division의 릴리즈 데이터만 기존 JSON 형태로 내보내어, 다른 구버전 해피툴 도구와의 완전한 호환성을 보존합니다.
> - **가져오기(Import)**: JSON 파일을 업로드하면 현재 활성화된 Division의 데이터에 병합되도록 하여 사용성을 직관적으로 유지합니다.
> 
> **3. UI 컴포넌트 분리 (500줄 규칙 준수)**
> 현재 `ReleaseHistoryPlugin.tsx` 파일은 391줄입니다. 이번 기능을 한 파일에 모두 욱여넣으면 500줄을 초과할 위험이 높습니다. 따라서 Division 선택, 추가, 삭제를 처리하는 UI 및 팝업 이벤트 핸들러를 별도의 컴포넌트인 `DivisionSelector.tsx`로 깨끗하게 독립시켜 유지보수성과 성능을 챙기겠습니다.

---

## Open Questions

- **Division 삭제 시 확인 절차**: 현재 선택된 Division을 삭제할 때, `CommonDialogs`의 `ConfirmDialog`를 띄워 "정말로 삭제하시겠습니까? 데이터가 모두 소멸됩니다."라는 안내를 내보낼 계획입니다. 이 동작이 적절한지 확인 부탁드립니다. (기본 "Default" Division은 삭제할 수 없도록 물리적으로 차단합니다.)

---

## Proposed Changes

### Release History Component & Types

#### [MODIFY] [types.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/ReleaseHistory/types.ts)
- `DivisionData` 인터페이스 정의 (`items: ReleaseItem[]`, `yearConfigs: Record<number, YearConfig>`)
- `ReleaseHistoryData` 인터페이스 구조 확장:
  ```typescript
  export interface DivisionData {
      items: ReleaseItem[];
      yearConfigs: Record<number, YearConfig>;
  }

  export interface ReleaseHistoryData {
      divisions: Record<string, DivisionData>;
      activeDivision: string;
  }
  ```

#### [NEW] [DivisionSelector.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/ReleaseHistory/components/DivisionSelector.tsx)
- Division 선택용 프리미엄 글래스모피즘 드롭다운 UI 컴포넌트 생성.
- Division 추가용 버튼 (`PromptDialog` 호출 트리거) 및 삭제용 아이콘 (`ConfirmDialog` 호출 트리거) 배치.
- Framer Motion을 사용하여 드롭다운 개폐 시 부드러운 애니메이션 효과 연출.

#### [NEW] [useReleaseHistoryDivisions.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/ReleaseHistory/hooks/useReleaseHistoryDivisions.ts)
- `ReleaseHistoryPlugin.tsx` 파일이 500줄 규칙을 넘어서는 것을 방지하기 위해 생성되는 커스텀 훅.
- 다중 Division의 추가/삭제/마이그레이션/조회 등 핵심 상태와 로컬 스토리지 라이프사이클을 전담 캡슐화.

#### [MODIFY] [ReleaseHistoryPlugin.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/plugins/ReleaseHistory/ReleaseHistoryPlugin.tsx)
- 커스텀 훅 `useReleaseHistoryDivisions`을 호출하여 모든 상태 로직을 위임하고 파일 라인 수를 ~390줄로 최적화.
- 헤더 영역 좌측에 신규 `DivisionSelector` 컴포넌트 마운트 및 `CommonDialogs`(`PromptDialog`, `ConfirmDialog`) 연결.

---

## Verification Plan

### Automated Tests
- `vitest`를 통해 `test/ReleaseHistory.test.tsx` 테스트 스위트 구동하여 기존 CRUD 테스트 및 데이터 마이그레이션 기능이 100% 정상 작동하는지 확인합니다.
- 다중 Division 기능을 검증하는 신규 단위 테스트 케이스를 `test/ReleaseHistory.test.tsx`에 추가하여 검증합니다.
  - 명령어: `wsl npx vitest run test/ReleaseHistory.test.tsx`

### Manual Verification
- 앱 빌드 기동 (`npm run dev` 또는 Electron 개발 모드 실행) 후, 실제 UI 상에서:
  - Default 디비전에서 릴리즈를 추가 및 수정해 봅니다.
  - Division 추가 버튼을 클릭해 새로운 Division을 만들고 전환해 봅니다.
  - 각 Division별로 릴리즈 목록이 완벽하게 분리/격리되어 관리되는지 테스트합니다.
  - 특정 Division을 삭제했을 때 목록에서 정상적으로 사라지는지, 그리고 데이터가 잘 보존되는지 확인합니다.
  - 기존 구버전 데이터가 있는 환경에서 로딩 시 정상적으로 Default 디비전으로 승계되는지 검증합니다.

---

### Proceed 승인 요청
형님, 계획을 검토해 주시고 승인하시면 아래 Proceed 버튼을 누르거나 "Proceed"라고 말씀해 주십시오! 🐧⚡

<button id="proceed-button" style="padding: 10px 20px; bg-color: #6366f1; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">Proceed</button>
