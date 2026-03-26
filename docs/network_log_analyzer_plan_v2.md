# NetTraffic 플러그인 선별적 복구 계획

형님, 꼬여버린 Git 실타래를 제가 깔끔하게 풀어서 **오늘 작업한 NetTraffic 기능만** 쏙쏙 골라 `0328` 브랜치에 심어드리겠습니다! 🐧🛠️

## 🎯 목표
- `stash@{0}`에 섞여 있는 파일들 중 `NetTraffic` 관련 파일만 추출
- `SpeedScope` 등 불필요한 변경사항 제외하고 순수하게 `NetTraffic` 기능만 복구
- 최신 `0328` 브랜치 상태 유지

## 🛠️ 추출 대상 파일 (New Files)
다음 파일들은 `stash@{0}`에서 그대로 가져옵니다:
- [NEW] `components/NetTrafficAnalyzer/NetTrafficAnalyzerPlugin.tsx`
- [NEW] `components/NetTrafficAnalyzer/NetTrafficAnalyzerView.tsx`
- [NEW] `hooks/useNetTrafficLogic.ts`
- [NEW] `workers/NetTraffic.worker.ts`
- [NEW] `docs/network_log_analyzer_plan.md`
- [NEW] `docs/test_result.txt`

## 📝 선별 수정 대상 (Modified Files)
다음 파일들은 `SpeedScope` 정보를 제외하고 `NetTraffic` 정보만 추가합니다:
- [MODIFY] `types.ts`: `NET_TRAFFIC_ANALYZER` enum 추가
- [MODIFY] `plugins/registry.ts`: `NetTraffic` 플러그인 등록
- [MODIFY] `plugins/core/wrappers.ts`: `NetTraffic` 컴포넌트 Lazy Load 및 Wrapper 설정
- [MODIFY] `important/APP_MAP.md`: `NetTraffic` 업데이트 내역 반영

---
형님, 이 계획대로 진행해도 될까요? **Proceed** 버튼을 눌러주시면 바로 수술 들어갑니다! 🐧💉🚀
