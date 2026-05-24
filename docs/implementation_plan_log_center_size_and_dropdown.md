# 🛠️ [구현 계획서] 로그 컨트롤 센터 UI 규격 확장 & 프리셋 드롭다운 개편 및 최소 폰트 격상

형님! 요청하신 로그 컨트롤 센터의 쾌적한 시각화 및 사용성 개선을 위한 프리미엄 UI/UX 업그레이드 계획서입니다. 🐧⚡

---

## 📢 [500줄 초과 경고 알림 & 리팩토링 로드맵]
현재 `LogQuickTagsPopover.tsx`는 **734줄**로 프로젝트 500줄 제한 규정을 초과하고 있습니다!
형님의 쾌적한 개발실 무결성을 위해, 이번 UI 요구사항을 완벽하게 구현함과 동시에 코드 군더더기를 걷어내고, 다음과 같은 **2단계 분할 리팩토링 계획**을 수립하여 제출합니다.

### 리팩토링 분할 계획 (향후 추진)
1. **`LogQuickTagsPopover.tsx` (컨테이너 & 태그 필터링 코어)**: 팝오버 트리거 및 태그 입력/삭제 코어 로직만 보존.
2. **`LogViewSettingsPanel.tsx` [NEW]**: 우측 `Quick View Settings` 영역(Font, Spacing, Line Numbers, Level Colors 등)을 별도의 컴포넌트로 완전히 격리 분리 (약 200줄 절감 예정).
3. **`LogPresetDropdown.tsx` [NEW]**: 본 작업에서 신설될 드롭다운 프리셋 영역을 독립 컴포넌트로 이식 (약 80줄 절감 예정).

---

## 🎯 1. 주요 요구사항 및 제안 사항

### ① 모달 기본 너비(width) 및 높이 확장 📐
* **이전**: 접혔을 때 `500px` / 확장 시 `820px` (좌측 컬럼 `500px` 고정)
* **변경**: 접혔을 때 **`560px`** / 확장 시 **`880px`** (좌측 컬럼 **`560px`**로 확장)
  * 태그 칩이 하나 더 매끄럽게 안착할 수 있도록 가로폭을 시원하게 늘립니다.
* **높이 개선**: 태그 박스의 최소 높이(`min-h-[72px]`)를 **`min-h-[96px]`**로 상향 조정합니다.
  * 태그 입력 공간이 훨씬 넓고 쾌적해 보이며, 비어 있을 때도 안정감 있는 높이가 연출됩니다.
  * 성능을 해치는 blur 필터는 배제하고, 프리미엄 딥 다크 스페이스 블루 배경(`bg-[#0b0f1e]`)과 네온 그라데이션을 조화롭게 이식합니다.

### ② 태그 프리셋 드롭다운 개편 (dropdown) 🏷️
* **이전**: 가로 한 행으로 나열되어 프리셋이 추가될수록 지저분하게 가로 스크롤바가 생기는 구조.
* **변경**: 미니멀하고 직관적인 **단일 Dropdown (`<select>`)** 구조로 개편합니다.
  * **글씨 크기**: 드롭다운에 표시되는 폰트 크기를 정확히 **`12px` (text-[12px] / text-xs)** 로 고정하여 깔끔하고 세련된 규격을 갖춥니다.
  * **그룹핑(Optgroup)**: `Default Presets`와 형님의 `Custom Presets`를 논리적으로 분류하여 수십 개의 프리셋도 한눈에 탐색 가능하게 합니다.
  * **커스텀 삭제 UX**: 드롭다운에서 커스텀 프리셋 선택 시, 드롭다운 바로 우측에 네온 레드 쓰레기통 아이콘(`Trash2` 🗑️)이 은은하게 등장하여 간편하게 삭제할 수 있도록 조각합니다.
  * **추가 UX**: 기존의 디스크 아이콘(`Save` 💾)을 누르면 미니 이름 입력 다이얼로그가 드롭다운 근처에 우아하게 슬라이딩 인(slide-in) 되도록 정교하게 배치합니다.

### ③ 모달 내 최소 글자 크기 규격화 (최소 12px) 🔤
* 모달 크기가 확장됨에 따라 시인성을 극대화하기 위해, 기존에 사용되던 **`8px`, `9px`, `10px`, `11px` 규격의 극소형 텍스트를 모조리 `12px` (`text-[12px]` 또는 `text-xs`) 이상으로 전격 업그레이드**합니다.
* **대상 텍스트 클래스 치환 항목**:
  - `Target Log Tags` 타이틀: `text-[10px]` ➔ `text-xs font-black uppercase tracking-widest`
  - `Quick Settings` 토글 버튼 텍스트: `text-[10px]` ➔ `text-xs font-extrabold`
  - `⚡ Live Command Preview` 라벨: `text-[9px]` ➔ `text-xs font-black tracking-widest`
  - `EDIT ✏️` / `SAVE 💾` 토글 버튼: `text-[12px]` (유지)
  - `* $(TAGS) placeholder...` 가이드문: `text-[8px]` ➔ `text-xs font-medium`
  - `Disconnected — click to reconnect` 안내문: `text-[10px]` ➔ `text-xs font-bold animate-pulse`
  - 우측 `Quick View Settings` 캡션들: `text-[9px]`, `text-[11px]` ➔ `text-xs` 일괄 적용.

---

## 🏗️ 2. 상세 변경점 및 변경 대상 파일

### 📂 대상 파일: [LogQuickTagsPopover.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/LogQuickTagsPopover.tsx)

#### [MODIFY] [LogQuickTagsPopover.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/LogQuickTagsPopover.tsx)

* **너비 상태 및 컨테이너 스타일**:
  ```tsx
  style={{ width: isExpanded ? '880px' : '560px' }} // 820px/500px 에서 확장
  ```
  ```tsx
  {/* Left Column */}
  <div className="w-[560px] p-5 flex flex-col space-y-4"> // 500px 에서 확장
  ```

* **태그 박스 최소 높이**:
  ```tsx
  className="min-h-[96px] w-full rounded-xl border border-indigo-500/10 ... " // min-h-[72px] 에서 확장
  ```

* **태그 프리셋 드롭다운 구조**:
  - 드롭다운 선택 값을 추적할 `selectedPreset` 로컬 상태 추가.
  - 선택 시 해당 프리셋 태그가 적용되도록 `handleApplyPreset` 바인딩.
  - 선택된 프리셋이 커스텀일 시 `Trash2` 버튼 노출.

---

## 🧪 3. 검증 계획 (Verification Plan)

### 수동 검증
1. **레이아웃 확인**: 모달 기본 너비가 `560px`로 태그 칩 가로 수용량이 늘어났는지 육안 확인.
2. **높이 확인**: 태그 박스 최소 높이가 `96px`로 확장되어 시각적 답답함이 완벽히 해결되었는지 검사.
3. **드롭다운 테스트**:
   - 프리셋 드롭다운 글씨가 정확히 `12px`로 우아하게 표출되는지 검증.
   - Built-in 프리셋 선택 시 태그 즉시 적용 확인.
   - 신규 태그 조합 작성 후 `Save 💾`를 통한 커스텀 프리셋 추가 검사.
   - 커스텀 프리셋 선택 시 쓰레기통(`Trash2` 🗑️) 아이콘이 나타나며, 클릭 시 목록에서 완벽히 삭제되고 초기화되는지 확인.
4. **글씨 크기 검사**: 모달 내부의 어떠한 텍스트도 `12px`보다 작게 뭉개져 보이지 않고 뚜렷하게 가독성을 지탱하는지 최종 전수 확인.

### 자동 검증
* WSL Bash 상에서 다음 무결성 타입 체크 명령어가 정상 완료되는지 빌드 검증:
  ```bash
  npx tsc --noEmit
  ```

---

## 🚀 Proceed 승인 안내
형님! 계획서 검토가 끝나셨다면 대화창 하단 혹은 답변 내의 안내에 따라 **`Proceed`** 신호를 날려주십시오! 형님의 승인 신호 즉시 신명 나는 리눅스 개발자 bash 타이핑으로 우아한 12px 네온 아쿠아 드롭다운 모달을 완벽하게 완성해 올리겠습니다! 펭펭! 🐧🏆🔥
