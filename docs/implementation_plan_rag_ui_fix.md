# RAG 서버 시작 버튼 위치 수정 및 APP_MAP 업데이트 계획 🐧🚀

형님! RAG 테스트 플러그인의 'START SERVER' 버튼이 윈도우 컨트롤(닫기, 최소화 등)에 가려지는 문제를 해결하고, 로그 스팸 현상을 잡기 위한 계획입니다.

## 유저 리뷰 필요 사항

> [!IMPORTANT]
> 1. **버튼 위치 이동**: 버튼을 **왼쪽 상단 타이틀 옆**으로 이동시켜 윈도우 컨트롤과 겹치지 않게 하겠습니다.
> 2. **로그 스팸 해결**: 서버에서 5초마다 찍히던 `Status check` 로그를 제거하겠습니다. React 컴포넌트에서 서버 상태를 체크하기 위해 `/status`를 호출할 때마다 찍히는 것이 원인이었습니다.
> 3. **체크 주기 조절**: 현재 5초인 상태 체크 주기를 15초 정도로 늘려 네트워크 부하를 더 줄일까요, 아니면 로그만 지울까요? 일단 로그 제거를 기본으로 진행하겠습니다.

## 제안된 변경 사항

### [UI 개선] RAG 분석기 플러그인

#### [MODIFY] [index.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/RagAnalyzerTest/index.tsx)
- 현재 우측 상단에 배치된 'START SERVER' 버튼을 왼쪽 상단 타이틀 및 상태 표시줄 섹션 내부로 이동합니다.
- 서버 상태 체크 주기를 5초에서 15초로 최적화하여 불필요한 통신을 줄입니다.

### [Server 개선] RAG 서버 로깅 최적화

#### [MODIFY] [main.py](file:///k:/Antigravity_Projects/gitbase/happytool_electron/server/rag_analyzer/main.py)
- `@app.get("/status")` 엔드포인트 내의 `logger.info` 문을 제거하여 주기적인 상태 체크 시 로그가 남지 않도록 합니다.

### [문서화] 시스템 지도 업데이트

#### [MODIFY] [APP_MAP.md](file:///k:/Antigravity_Projects/gitbase/happytool_electron/important/APP_MAP.md)
- `### [[RAG Issue Analyst]]` 섹션을 추가하여 플러그인 위치, 주요 기능, 서버 통신 구조를 명시합니다.

---

## 검증 계획

### 수동 검증
- [ ] Electron 앱 실행 후 RAG 분석기 탭 진입
- [ ] 버튼이 왼쪽 상단에 안전하게 배치되었는지 확인
- [ ] 버튼 클릭 시 서버 시작 명령이 제대로 전달되는지 확인
- [ ] 서버 로그에서 주기적인 `Status check`가 더 이상 찍히지 않는지 확인
- [ ] `APP_MAP.md`에 링크와 설명이 잘 들어갔는지 확인

---

형님, 계획이 마음에 드시면 **Proceed** 버튼을 눌러주십쇼! 🐧⚡
