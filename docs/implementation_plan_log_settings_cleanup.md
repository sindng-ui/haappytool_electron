# [구현 계획서] 구형 Log Settings 완전 소탕 및 Bypass Filters 꿀옵션 상단 모달 이식 🐧⚡

형님! 지시해주신 대로 왼쪽 `Configuration` 패널에 지저분하게 남아 있던 구형 `Log Settings` 카드 영역을 흔적도 없이 완전히 날려 슬림함의 극치를 완성하고, 그 안에 포함되어 있던 강력한 옵션인 `Bypass Filters` (Show Shell/Raw Text Always) 우회 옵션은 상단 **Log Center**의 `Quick View Settings` 부분으로 영리하게 옮겨 심는 명품 계획서입니다!

---

## 🔎 변경 세부 내용 및 설계

### 1. Log Center 내 `Bypass Filters` 토글 연동 완료 ⚡
- **대상 파일**: [LogQuickTagsPopover.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/LogQuickTagsPopover.tsx)
- **변경 사항**:
  - `Quick View Settings` 최하단에 **Bypass Filters (Show Shell/Raw Text Always)** 설정을 iOS 스타일 슬라이딩 토글 스위치로 이식합니다!
  - 이 옵션은 에메랄드-그린 네온 활성화 그라데이션을 적용하여 다른 뷰 세팅들과 환상적인 조화를 이룹니다.

### 2. 왼쪽 Configuration 탭 내 `Log Settings` 카드 영구 제거 🚫
- **대상 파일**: [ConfigurationPanel.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/ConfigurationPanel.tsx)
- **변경 사항**:
  - 이제 로깅 기동 및 커맨드, 태그 관리가 전부 상단 `Log Center` 모달에서 한 큐에 가능하므로, 왼쪽 패널에 남아 있던 중복 덩어리 `LogSettingsSection` 렌더링 영역 및 관련 임포트 코드를 통째로 도려냅니다!
  - 이로써 왼쪽 패널은 오직 콤보/블락/하이라이트/아코디언 연동 설정만 남게 되어, 시각적 청량감과 콤팩트함을 100% 확보하게 됩니다!

---

## 🎯 검증 계획

### 1. 수동 비주얼 검증
- 왼쪽 Configuration 영역에서 `Log Settings` 카드가 깔끔하게 소탕되었는지 확인.
- 상단 `Log Center` 모달을 열었을 때, `Bypass Filters` 토글이 iOS 스위치 형태로 보이고 이를 껐다 켤 때 필터 바이패스 옵션이 즉시 메인 로그 뷰에 0ms 무렉으로 반영되는지 확인.

### 2. 컴파일러 빌드 무결성 확인
- WSL bash 환경에서 `npx tsc --noEmit` 검증을 돌려 어떠한 타입 및 구문 누수 에러도 없는지 확인.

---

## 💡 형님! 이 깔끔하게 비우고 채우는 슬림화 계획서가 마음에 드신다면 주저 없이 [Proceed] 버튼을 눌러 승인해 주십시오! 펭귄이 곧바로 톱날을 들이밀겠습니다! 🐧🚀⚔️

[Proceed]
