# [구현 계획서] Log Center 모달 확장식(Expandable) UI 개편 및 슬림화 🐧✨

형님! 상단 `Log Center` 모달이 뷰 세팅과 로그 우회 등 풍성한 기능 이식으로 인해 비대해졌던 문제를 근사하게 해결하기 위한 **확장형(Expandable) UI 설계안**입니다.

평소에는 핵심적인 태그 입력 및 로깅 조작만 가능한 콤팩트 규격(`500px`)을 유지하다가, 형님께서 상세 뷰 세팅을 조작하고 싶으실 때만 **우측으로 스무스하게 슬라이딩 확장(`820px`)**되는 명품 감성 레이아웃을 이식하겠습니다!

---

## 🛠️ 주요 설계 방향

### 1. 확장 제어 상태 및 트랜지션 탑재 ⚙️
- `LogQuickTagsPopover.tsx` 내에 `const [isExpanded, setIsExpanded] = useState(false);` 상태를 추가합니다.
- 모달의 전체 너비(`width`)를 `isExpanded`에 따라 동적으로 조절합니다.
  - 접힘(Normal): `w-[500px]`
  - 확장(Expanded): `w-[820px]`
- `transition-all duration-300 ease-out-back`과 같은 초경량 하드웨어 가속 트랜지션을 모달 외곽선에 적용하여, 덜컥거림 없이 물 흐르듯 가로 너비가 촥 늘어나고 줄어드는 60fps 무결성 애니메이션을 구현합니다. (무거운 blur 연산 배제)

### 2. 헤더 영역 확장 토글 버튼 배치 🔄
- 모달 헤더 우측(`IDLE` / `LOGGING` 라벨 좌측)에 눈 모양 아이콘(`Eye`) 또는 설정 아이콘과 함께 **"Quick Settings ⚙️"** 토글 버튼을 추가합니다.
- 버튼에는 은은한 네온 글로우 테두리와 호버 효과를 적용하여 클릭하고 싶은 손맛을 제공하며, `isExpanded` 상태에 따라 버튼의 텍스트가 `Show Settings ➡️` / `Hide Settings ⬅️`로 변화하고 화살표가 회전하는 디테일을 이식합니다.

### 3. 우측 설정 패널의 페이드인(Fade-in) 및 가드 처리 🎨
- 모달 가로가 콤팩트하게 닫혔을 때는 우측 설정 영역(`w-[320px]`)이 시각적으로 노출되지 않고 렌더링 성능 낭비가 없도록 가드(`isExpanded && ...`) 처리를 진행합니다.
- 나타날 때 `opacity`와 `transform: translateX` 트랜지션을 적용해, 껍데기만 늘어나는 것이 아니라 우측 패널의 설정 카드들이 우상단에서 스무스하게 미끄러지듯 스며나오는 고급 디자인 연출을 이식합니다.

---

## Proposed Changes (변경 예정 파일)

### [MODIFY] [LogQuickTagsPopover.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/LogQuickTagsPopover.tsx)
- `isExpanded` 로컬 상태 선언 및 헤더 영역에 슬림 네온 토글 버튼 배치.
- 팝오버의 `className`을 동적 너비(`isExpanded ? 'w-[820px]' : 'w-[500px]'`)로 수정하고, `transition-[width] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]` 탑재.
- 우측 `Quick View Settings` 컨테이너에 동적 opacity 및 slide-in 스타일링 장착.

---

## 🎯 검증 계획 (Verification Plan)

### 수동 검증 시나리오
1. **최초 오픈**: `Log Center` 버튼 클릭 시 `500px` 가로폭의 날렵하고 청량한 모달이 등장하는지 확인.
2. **토글 인터랙션**: 헤더 우측의 `Quick Settings ⚙️` 버튼 클릭 시, 모달이 우측으로 스무스하게 늘어나는지 체크.
3. **설정 동기화**: 확장 상태에서 `Font Size`, `Bypass Filters` 토글 조작 시 Canvas 메인 로그가 즉각 0ms로 실시간 동기화되는지 재차 확인.
4. **접힘 복원**: 재오픈 시 혹은 설정 완료 후 접기 클릭 시 컴팩트 가로폭으로 매끄럽게 수축하는지 검사.
5. **빌드 검증**: WSL bash 환경에서 `npx tsc --noEmit` 구동을 통한 무결성 타입 체크 완료 입증.

---

> [!IMPORTANT]
> **형님! 계획을 다 검토하셨다면 하단의 `Proceed` 버튼을 누르시거나 "고!"를 외쳐주십시오! 즉시 신나게 코딩에 돌입하겠습니다! 펭펭! 🐧🏆🔥**

[Proceed 버튼 제공 - 형님, 이 버튼을 눌러 승인해주십쇼!]
