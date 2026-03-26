# NetTraffic 분석기 완전 승격 및 빌드 오류 수정 🐧💎🎯

`NetTraffic Analyzer`를 실험실(Lab) 단계에서 정식 핵심(Core) 플러그인으로 승격시키고, 메인 사이드바에 기본 노출되도록 설정 및 마이그레이션 로직을 업데이트합니다. 또한 `vite` 빌드 오류를 해결하여 안정적인 개발 환경을 복구합니다.

## Proposed Changes

### Global Layout & System Hierarchy

#### [MODIFY] [App.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/App.tsx)
- `defaultEnabledPlugins` 배열에 `ToolId.NET_TRAFFIC_ANALYZER`를 추가하여 신규 사용자의 사이드바에 기본 노출되도록 합니다.
- 설정 로드 `useEffect` 내에 마이그레이션 로직을 추가합니다. 기존 사용자의 `enabledPlugins` 목록에 `NET_TRAFFIC_ANALYZER`가 없을 경우 자동으로 추가하여, '실험실' 탭으로 숨겨지지 않도록 보장합니다.

### Plugin Component

#### [MODIFY] [NetTrafficAnalyzerView.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/NetTrafficAnalyzer/NetTrafficAnalyzerView.tsx)
- `vite` 빌드 실패의 원인이 될 수 있는 JSX 렌더링 블록 내의 삼항 연산자 체인 및 괄호 구조를 정밀하게 재점검하고 교정합니다. (Step 1834: `832: ) : analyzing ? (` 구간 집중 확인)
- 불필요하거나 중복된 `import` 및 타입을 정리하여 빌드 안정성을 높입니다.

## Verification Plan

### Automated Tests
- `npm run electron:dev` 명령을 실행하여 `vite` 빌드가 성공하고 앱이 정상 기동되는지 확인합니다.

### Manual Verification
1. 앱 기동 후 좌측 사이드바 메인 섹션(실험실 밖)에 `NetTraffic` 아이콘이 즉시 노출되는지 확인합니다.
2. `Settings` 모달의 플러그인 관리 탭에서 `NetTraffic`이 목록에 표시되며, 체크 해제 시 사이드바에서 사라지고 체크 시 다시 나타나는지 확인합니다.
3. `localStorage`를 강제로 초기화한 후에도 기본적으로 `NetTraffic`이 활성화 상태인지 확인합니다.

---
형님, 이 계획대로 진행해도 될까요? 승인해주시면 바로 코딩 들어가서 정식 론칭하겠습니다! 🐧🚀
