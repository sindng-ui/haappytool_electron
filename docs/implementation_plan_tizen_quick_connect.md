# ⚡ Tizen Quick Connection 원클릭 자동 연결 구현 계획서

본 계획서는 Log Extractor 상단 툴바의 **번개(Lightning) 아이콘** 클릭 시, 기존에 단순히 모달창만 띄우던 동작에서 **마지막으로 성공했던 연결 수단(SSH / SDB / Serial / Simulate) 및 세부 정보를 읽어 들여 1초 만에 백그라운드 소켓 자동 다이렉트 연결**을 보장하고, 연결 도중 고급스러운 전용 로딩 인디케이터를 띄우는 UX 고도화 작업을 다룹니다.

---

## 1. 분석 및 설계 (Analysis & Design)

### 1) 현재 제어 흐름 분석
* **상단 툴바 (`components/LogViewer/TopBar.tsx`)**:
  * 번개 아이콘 클릭 시 `onQuickConnect()`가 실행되어 `isTizenQuickConnect(true)` 및 `isTizenModalOpen(true)`가 켜집니다.
* **Tizen 연결 모달 (`components/TizenConnectionModal.tsx`)**:
  * `isOpen={isTizenModalOpen}`과 함께 마운트되며, 내부 `useEffect`를 통해 로컬 소켓 서버(`http://127.0.0.1:3003`)와 소켓 세션을 연결합니다.
  * 그러나 기존에는 소켓이 연결(`connect` 이벤트)된 후에도 사용자가 모달에서 수동으로 `CONNECT & START STREAM` 버튼을 클릭해야만 실제 연결 통신이 기동되었습니다.

### 2) 개선 사양
1. **소켓 수립 시 원클릭 다이렉트 연동**:
   * `isQuickConnect` prop이 `true` 이고 소켓 `connect` 이벤트가 최종 감지되는 순간, `localStorage`에 저장되어 있는 마지막 연결 정보(`lastConnectionMode`, IP, Port 등)를 기반으로 **소켓 연결 명령 메세지(`connect_sdb`, `connect_ssh` 등)를 자동 발송**합니다.
2. **퀵 커넥트 전용 프리미엄 로딩 오버레이 구현**:
   * 퀵 커넥트가 백그라운드에서 조용히 돌아가는 동안, 복잡한 설정 폼 대신 **바운싱하는 노란색 번개 펄스 모션**과 **글래스모피즘(Backdrop blur) 효과**를 가진 미려한 연결 대기 팝업을 연출합니다.
   * 연결 성공 시 0.1초 만에 팝업이 닫히며 스트리밍이 가동됩니다.
   * 연결에 실패하거나 SDB 환경이 잡혀있지 않을 경우, 예외 안내 메시지와 `Cancel Connection` 버튼을 안전하게 노출하여 복원 및 수동 모드 폴백(Fallback)을 보장합니다.

---

## 2. 세부 구현 대상 (Target Files)

### 1) [components/TizenConnectionModal.tsx](file:///mnt/k/Antigravity_Projects/gitbase/happytool_electron/components/TizenConnectionModal.tsx)
* 소켓 `connect` 리스너 핸들러 하단에 `isQuickConnect` 확인 분기를 증설하여 자동 연결 이벤트를 논스톱으로 트리거합니다.
* 퀵커넥트 연동 중일 때 표시할 프리미엄 전용 로딩 마크업 및 예외 처리 가드를 장착합니다.

---

## 3. 리스크 검토 및 리그레션 가드 (Safety Guards)
* **비동기 경쟁 조건 방지**: React State 업데이트 지연에 영향을 받지 않도록, `useEffect` 내부에서 갓 수립된 로컬 `newSocket` 인스턴스를 직접 활용하여 다이렉트 통신을 개시함으로써 상태 불일치 문제를 차단합니다.
* **비활성 상태 격리**: 퀵 커넥트가 아닌 일반 모달 열기 시에는 기존 수동 입력 폼이 100% 동일하게 유지되어 기존 사용자 경험에 미치는 사이드 이펙트가 제로(0%)입니다.

---

## 4. 유저 피드백 및 Proceed 승인요청

> [!IMPORTANT]
> 형님! 구현 계획을 자세히 숙지해 주시고, 마음에 드신다면 아래 **PROCEED** 버튼을 누르거나 채팅창에 승인 메시지를 주십시오! 바로 번개 같은 속도로 고품격 자동 연결 기능을 장착하겠습니다! 🐧🥊

### [ PROCEED - 자동 연결 승인하기 ]
*(채팅창에 "고고" 혹은 "승인"이라고 입력해 주시면 코딩을 즉시 기동하겠습니다!)*
