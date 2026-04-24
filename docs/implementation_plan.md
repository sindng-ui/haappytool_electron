# 릴리즈 히스토리 플러그인 고도화 계획서 🚀

형님, 릴리즈 히스토리 플러그인을 더욱 강력하게 만들기 위한 작업 계획입니다. OS 업그레이드와 같은 복수 년도 상황을 완벽하게 지원하고, 년도별 최신 버전을 한눈에 파악할 수 있도록 개선하겠습니다.

## 유저 리뷰 필요 사항

> [!IMPORTANT]
> **데이터 구조 변경에 따른 마이그레이션**: 기존 `productName` 필드를 `years` 배열로 대체합니다. 기존 데이터 중 `productName`이 "2024"와 같이 숫자인 경우 자동으로 `years: [2024]`로 변환하며, 숫자가 아닌 경우 `releaseDate`의 년도를 기본값으로 사용하도록 마이그레이션 로직을 태우겠습니다.

> [!TIP]
> **년도별 최신 버전 수동 설정**: 자동으로 계산된 최신 버전 외에 형님이 직접 특정 버전을 '최신'으로 지정할 수 있는 기능을 추가합니다. 이 정보는 별도의 `yearConfigs` 객체에 저장되어 관리됩니다.

## 제안된 변경 사항

---

### 1. 데이터 모델 및 타입 정의 (`plugins/ReleaseHistory/types.ts`)

- [MODIFY] `ReleaseItem` 인터페이스 수정: `productName: string` -> `years: number[]`
- [NEW] `YearConfig` 인터페이스 추가: `{ year: number, latestVersion?: string, latestReleaseId?: string }`
- [NEW] `ReleaseHistoryData` 인터페이스: `items`와 `yearConfigs`를 포함하는 전체 데이터 구조

### 2. 메인 플러그인 로직 (`plugins/ReleaseHistory/ReleaseHistoryPlugin.tsx`)

- [MODIFY] 상태 관리 업데이트: `items`뿐만 아니라 `yearConfigs`도 `localStorage`에 저장 및 로드
- [MODIFY] 마이그레이션 로직 보강: 기존 데이터를 신규 규격으로 자동 변환
- [MODIFY] 핸들러 추가: 년도별 최신 버전 설정을 위한 `handleUpdateYearConfig` 추가

### 3. Add Release 모달 (`plugins/ReleaseHistory/components/AddReleaseModal.tsx`)

- [MODIFY] **Product Name -> YEAR**: 단일 입력창을 다중 선택 가능한 UI(태그 시스템과 유사한 방식 혹은 체크박스)로 변경
- [MODIFY] **Release Name Hint**: `e.g. PluginA` -> `e.g. 26R1`
- [MODIFY] **Release Date Icon**: 달력 아이콘이 어두운 배경에서도 잘 보이도록 스타일 수정 (`text-rose-400` 강화 및 배경 대비 조정)

### 4. 타임라인 그래프 뷰 (`plugins/ReleaseHistory/components/TimelineGraphView.tsx`)

- [MODIFY] **년도 레이블 강화**: 좌측 년도 표시 옆에 해당 년도의 최신 버전(vX.Y.Z) 표시
- [NEW] **자동 최신 버전 계산**: 별도 설정이 없으면 해당 년도의 가장 최근 `releaseDate`를 가진 아이템의 버전을 표시
- [NEW] **수동 변경 UI**: 최신 버전 표시 옆에 작은 편집 아이콘을 추가하여 유저가 직접 버전을 입력하거나 선택할 수 있게 함
- [MODIFY] **클릭 이벤트**: 최신 버전 텍스트 클릭 시 해당 릴리즈의 상세 모달 호출

### 5. 기타 UI 및 유틸리티

- [MODIFY] `ListView.tsx`: 제품명 대신 년도별로 그룹화하여 표시 (하나의 아이템이 여러 년도에 걸칠 경우 중복 표시)
- [MODIFY] `ReleaseDetailModal.tsx`: 'Product' 레이블을 'Years'로 변경하고 선택된 모든 년도 표시
- [MODIFY] `ExportImportUtils.ts`: 신규 필드(`years`, `yearConfigs`)를 포함하여 내보내기/가져오기 기능 업데이트

## 검증 계획

### 자동화 테스트
- `wsl npm test plugins/ReleaseHistory` 명령어를 통해 기존 기능의 리그레션 체크
- 신규 데이터 구조에 대한 단위 테스트 (필요 시 작성)

### 수동 검증
1. **데이터 마이그레이션**: 기존 데이터를 로드했을 때 년도가 정상적으로 추출되는지 확인
2. **복수 년도 선택**: 한 릴리즈에 2024, 2025년을 동시에 선택하고 타임라인과 리스트 뷰에서 각각 잘 보이는지 확인
3. **최신 버전 수동 설정**: 특정 년도의 최신 버전을 수동으로 변경했을 때 타임라인에 즉시 반영되는지 확인
4. **UI 가독성**: 달력 아이콘과 년도별 버전 표시가 명확하게 보이는지 확인

---

형님, 이 계획대로 진행해도 될까요? 승인해주시면 바로 작업 시작하겠습니다! 🐧🚀
