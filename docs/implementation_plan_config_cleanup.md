# [구현 계획서] Log Center 내 Font Family 이식 및 Configuration 영역 군더더기 완전 제거 🐧⚡

형님! 상단 `Log Center` 모달 내에 `Font Family`를 이식하고, 왼쪽 `Configuration` 영역의 중복되던 `View Settings`를 제거하여 공간을 획기적으로 절약하는 동시에, 평소에 쓰지 않는 `Performance Analysis Settings` 를 아코디언처럼 예쁘게 접을 수 있도록 개선하여 패널의 가시성을 극대화하는 계획서입니다!

---

## 🔎 변경 세부 내용 및 설계

### 1. Log Center 내 `Font Settings` 연동 완료 🎨
- **대상 파일**: [LogQuickTagsPopover.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/LogQuickTagsPopover.tsx)
- **변경 사항**:
  - `Quick View Settings` 영역 안에 **Font Family (드롭다운)** 및 **Font Size (인풋)**, **Line Spacing (슬라이더)**을 아름다운 프리미엄 테크 네온 디자인과 함께 한곳으로 이식합니다.
  - 이를 통해 뷰어 설정의 모든 기능들이 `Log Center` 상단 모달 하나로 완벽히 오케스트레이션(통합 제어)됩니다!

### 2. 왼쪽 Configuration 탭 내 `View Settings` 중복 제거 🚫
- **대상 파일**: [ConfigurationPanel.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/ConfigurationPanel.tsx)
- **변경 사항**:
  - 이제 설정의 모든 기능이 상단 모달로 이동했으므로, 왼쪽 패널에서 완전히 겹치는 구형 `ViewSettingsSection` 렌더링 블록을 과감하게 날려서 패널의 복잡도를 혁신적으로 줄입니다!

### 3. Performance Analysis Settings 접기식 아코디언 개조 📂
- **대상 파일**: [PerfSettingsSection.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/ConfigSections/PerfSettingsSection.tsx)
- **변경 사항**:
  - 평소에 안 쓰는 설정이므로 `isCollapsed` 로컬 상태를 추가하고 기본값을 `true` (접힌 상태)로 설정합니다.
  - 제목 라인에 호버 이펙트와 우측 `ChevronDown` / `ChevronUp` 회전 아이콘을 부여하고 클릭 시 토글되게 합니다.
  - `Framer Motion` 의 `motion.div` 와 `AnimatePresence` 를 적용하여 클릭 시 `height: 0` 에서 `height: 'auto'` 로 물 흐르듯 접히고 펼쳐지는 명품 인터랙션을 부여합니다! (성능 무결성을 수호하기 위해 `blur` 는 전혀 사용하지 않습니다.)

---

## 🎯 검증 계획

### 1. 수동 비주얼 검증
- 모달 내에서 `Font Family`를 Consolas, Courier 등으로 바꿨을 때 즉각 메인 Canvas 폰트가 변경되는지 확인.
- 왼쪽 Configuration 패널에서 `View Settings` 가 깔끔히 제거되어 나타나지 않는지 확인.
- `Performance Analysis Settings` 가 최초 진입 시 예쁘게 접혀서 나오고, 클릭 시 프레임 드랍 없이 스무스하게 슬라이딩 다운/업이 일어나는지 확인.

### 2. 빌드 무결성 확인
- WSL bash 에서 `npx tsc --noEmit` 검증을 진행해 컴파일 안정성 검토.

---

## 💡 형님! 계획서와 변경안이 마음에 드신다면 아래 [Proceed] 버튼을 눌러 승인해 주십시오! 즉시 깔끔하게 밀어버리겠습니다! 🐧🚀🏆

[Proceed]
