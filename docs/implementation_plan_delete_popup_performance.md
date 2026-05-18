# 🚀 글로벌 삭제 팝업 백드롭 블러 최적화 구현 계획서

형님! 글로벌 삭제 및 확인 팝업(`ConfirmDialog`, `PromptDialog`)이 뜰 때 발생하는 성능 저하 문제를 완벽히 해결하기 위한 초고속 GPU 가속 백드롭 최적화 구현 계획서입니다. 🐧⚡

## 🎯 문제 분석
현재 공용 대화창 시스템([CommonDialogs.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/ui/CommonDialogs.tsx))의 백드롭(배경 오버레이) 영역에 `backdrop-blur-sm` 스타일이 적용되어 있습니다.

- **성능 저하 원인**: `backdrop-blur` 필터는 브라우저가 화면을 렌더링할 때 하위 모든 레이어(대규모 로그 리스트, 복잡한 트리 뷰, 다양한 실시간 차트 등)를 실시간으로 픽셀 블러 연산하도록 강제합니다. 이로 인해 팝업이 부드럽게 나타나고(Fade-in) 사라질(Fade-out) 때 화면이 심하게 버벅거리거나 프레임 드랍(GPU 병목)이 발생합니다.
- **해결 방안**:
  - `backdrop-blur-sm` 필터를 완전히 제거합니다.
  - 가독성을 완벽하게 유지하면서 눈이 편안한 프리미엄 어두운 반투명 색상(`bg-slate-950/75` 또는 `bg-black/75`)을 적용하여 하드웨어 가속(GPU)이 완전하게 작동하도록 유도합니다.
  - 이를 통해 CPU/GPU 부하를 0%에 가깝게 줄이고, 60fps의 부드러운 애니메이션을 구현합니다.

---

## 🛠️ 상세 변경 계획

### 1. [CommonDialogs.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/ui/CommonDialogs.tsx) 최적화
`BaseDialog`의 백드롭 `motion.div` 클래스명 변경:
- **기존**: `className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"`
- **변경**: `className="absolute inset-0 bg-slate-950/75"`
  - 블러를 제거하는 대신 어두운 알파값(투명도)을 `60%`에서 `75%`로 소폭 늘려 백그라운드 요소들이 팝업 가독성을 방해하지 않도록 정밀 튜닝합니다.

### 2. [APP_MAP.md](file:///k:/Antigravity_Projects/gitbase/happytool_electron/important/APP_MAP.md) 업데이트
- `[[Common Dialog System]]` 항목에 이번 GPU 최적화 및 블러 제거 내역을 업데이트하여 동료 개발자와 AI에게 최신 아키텍처 상태를 전파합니다.

---

## 📋 테스트 계획
1. **정상 빌드 여부 확인**: `npm run build` 또는 개발 서버 구동 테스트.
2. **시각적 완성도 검증**: PostTool 등에서 삭제(Delete) 버튼을 눌러 `ConfirmDialog`를 띄우고, 배경이 깔끔하게 차단되며 대화상자가 부드럽고 빠릿하게 나타나는지 확인.
3. **프레임 드랍 확인**: 애니메이션 진행 시 끊김이 없는지 눈으로 검증.

---

형님! 이 계획서대로 작업을 진행해도 되겠습니까? 
아래 **Proceed** 버튼을 눌러 승인해주시거나 말씀해주시면 바로 빛의 속도로 코딩을 완료하겠습니다! 🐧🔥

[Proceed 버튼]
*(형님, 아래 대답으로 "proceed" 혹은 "진행해" 라고 입력해 주시면 신나게 달리겠습니다!)*
