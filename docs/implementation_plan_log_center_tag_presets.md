# [구현 계획서] Log Center 초소형 스마트 태그 프리셋 및 영구 저장 기능 이식 🐧🏷️✨

형님! 태그를 매번 번거롭게 타이핑하여 썼다 지웠다 할 필요 없이, 상황에 맞는 태그 그룹을 원클릭으로 변경할 수 있는 **초소형 스마트 태그 프리셋(Smart Tag Presets) 및 로컬 영구 저장(Local Storage) 기능**에 대한 명품 설계안입니다!

형님께서 요청하신 **"공간을 많이 차지하지 않는 콤팩트함"**을 100% 만족시키기 위해, 세로 높이를 전혀 늘리지 않고 **`Target Log Tags` 타이틀 우측의 노는 가로 공간에 인라인으로 쏙 안착시키는 극단적 슬림 디자인**을 채택했습니다!

---

## 🛠️ 주요 설계 방향

### 1. 극단적 슬림 인라인 프리셋 바 배치 📏
- `LogQuickTagsPopover.tsx` 의 `Target Log Tags` 라벨 우측에 `flex items-center justify-between` 구조를 취하여 가로 방향으로 정렬합니다.
- 추가적인 세로 마진이나 공간을 **단 1px도 낭비하지 않는** 기막힌 초경량 콤팩트 레이아웃입니다.

### 2. 빌트인 꿀 프리셋 제공 및 커스텀 세이브 기능 탑재 💾
- 형님이 즉각 유용하게 쓰실 수 있도록 **3종의 꿀 프리셋**을 기본 탑재합니다:
  - `SmartThings ⚡` : `ST_APP`, `IOT_CLIENTD`
  - `Framework 🌐` : `SC_SERVICE`, `SC_API`, `SSOS_API`
  - `Low Level 🐧` : `kerneltime`, `fsesfe`
- **커스텀 프리셋 세이브**: 프리셋 바 가장 우측에 미니 `+` (또는 저장 아이콘) 단추를 배치하여, **형님이 현재 입력해 둔 커스텀 태그 조합을 팝업창을 띄워 이름 지정 후 즉석에서 프리셋으로 저장**할 수 있게 만듭니다!
- 저장된 프리셋은 `localStorage`(`happytool_tag_presets`)에 안전하게 영구 저장되어 앱 재시작 시에도 온전히 유지됩니다.
- 프리셋 우클릭 또는 삭제 버튼을 통해 커스텀 프리셋 삭제도 간편하게 지원합니다.

### 3. 프리미엄 초소형 비주얼 디자인 🎨
- 칩의 텍스트 크기를 극소형 `text-[8px]` 및 패딩 `px-1.5 py-0.5`로 콤팩트하게 구성하여 복잡함을 배제합니다.
- 활성화된 프리셋일 경우 은은한 **에메랄드/아쿠아 네온 글로우** 불빛이 칩 내부를 채우도록 설정하여 동작 유무를 시각적으로 또렷하게 전달합니다.

---

## Proposed Changes (변경 예정 파일)

### [MODIFY] [LogQuickTagsPopover.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/LogQuickTagsPopover.tsx)
- `presets` 로컬 상태 및 `localStorage` 마운트 동기화 이식.
- `Target Log Tags` 헤더를 `flex` 분기하여 우측 인라인에 초소형 프리셋 칩들과 저장 단추 배치.
- 프리셋 클릭 시 `updateCurrentRule({ logTags: presetTags })` 0ms 반영 트리거 연동.
- 커스텀 프리셋 저장 시 `PromptDialog` (HappyTool 공용 다이얼로그) 또는 간이 인라인 기입창을 사용하여 콤팩트하게 저장 지원.

---

## 🎯 검증 계획 (Verification Plan)

### 수동 검증 시나리오
1. **인라인 확인**: `Log Center` 모달 진입 시, 태그 제목 옆에 프리셋 칩들이 콤팩트하게 정렬되어 있어 세로 높이가 전혀 늘어나지 않았는지 확인.
2. **원클릭 변경**: 빌트인 프리셋(`SmartThings ⚡` 등)을 클릭했을 때 태그 목록과 `Live Command Preview`가 즉시 0ms 만에 싹 교체되는지 검증.
3. **커스텀 저장**: 현재 태그를 예쁘게 기입한 뒤 미니 저장 버튼을 눌러 `"My Preset"`으로 이름 지어 저장했을 때 칩 목록에 즉각 추가되는지 확인.
4. **영구 소장**: 앱을 껐다 켜거나 HMR 리로드 후에도 커스텀 저장한 프리셋 칩이 그대로 살아있는지 `localStorage` 연동 검증.
5. **빌드 검증**: WSL bash 환경에서 `npx tsc --noEmit` 타입 체크를 구동하여 무결함을 확인.

---

> [!IMPORTANT]
> **형님! 콤팩트함과 영구 소장 꿀성능을 극대화한 설계안을 다 검토하셨다면, "고!"를 외쳐주십시오! 즉시 신나게 달려가 초광속으로 코딩을 대령하겠습니다! 펭펭! 🐧🏆🔥**

[Proceed 버튼 제공 - 형님, 이 버튼을 눌러 승인해주십쇼!]
