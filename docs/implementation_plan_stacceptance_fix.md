# [구현 계획] PostTool SmartThings ACC (stacceptance.com) 요청 이슈 재분석 및 개선 계획 (v2)

형님의 피드백("Prod/ACC는 동일 Bearer Token으로 요청 가능")을 반영하여 정확한 원인을 재분석하고 작성한 구현 계획서입니다.

## 원인 재분석 (Root Cause Re-analysis)

> [!IMPORTANT]
> **핵심 전제 및 진짜 원인 분석**
> - **전제**: SmartThings Prod(`client.smartthings.com`)와 ACC(`client.stacceptance.com`)는 동일한 Bearer Token으로 통신이 가능합니다.
> 
> **발생 원인 요약**:
> 1. **Host / Origin 헤더 불일치 (Host Header Mismatch)**:
>    - 유저가 Prod용 요청 헤더(`Host: client.smartthings.com`)를 복사 또는 수동 지정한 상태에서 URL만 `client.stacceptance.com`으로 변경할 경우, Node.js `fetch`가 OpenResty 게이트웨이로 잘못된 Host 헤더를 전송하여 routing/SNI mismatch 에러가 발생함.
> 2. **Node.js `fetch` (Undici)의 Redirection 시 `Authorization` Header Drop 현상**:
>    - ACC 서버(`client.stacceptance.com`) 게이트웨이가 HTTP 301/302/307 리다이렉트 응답을 줄 때, Node.js 기본 `fetch`는 교차 도메인/서브도메인 리다이렉트 시 보안 이유로 `Authorization` 헤더를 자동으로 제거(strip)하고 재요청을 보내어 결국 401 에러가 발생함.
> 3. **Electron Proxy (`proxyRequest`)의 에러 마스킹 (Status 0 처리)**:
>    - `electron/main.cjs`의 `proxyRequest`에서 리다이렉트/네트워크/헤더 문제 발생 시 단순 `{ error: true }`를 리턴하여, PostTool UI가 4xx/5xx 상태 코드와 서버 바디를 보여주지 못하고 `Proxy Request Failed` (Status 0 Error)로 표시됨.

---

## 사용자 검토 필요 사항 (User Review Required)

> [!NOTE]
> - PostTool에서 API 전송 시 URL의 Host와 다른 잔여 `Host` 헤더가 입력되어 있으면 자동으로 URL 도메인 기준 Host로 정제(Sanitize)하도록 처리합니다.
> - Electron Proxy (`proxyRequest`)에서 HTTP Redirection 시 `Authorization` 헤더가 수동 유지될 수 있도록 `redirect: 'manual'` 또는 헤더 보존 로직을 적용합니다.

---

## 제안하는 변경 사항 (Proposed Changes)

---

### [Electron Backend (`electron/main.cjs`)]

#### [MODIFY] [main.cjs](file:///K:/Antigravity_Projects/gitbase/happytool_electron/electron/main.cjs)
- `proxyRequest` 핸들러 개선:
  - **Host Header Sanitize**: 요청 헤더에 `Host` 헤더가 포함되어 전달될 경우 target URL의 host와 다르면 자동으로 제거 또는 target URL의 host로 오버라이드.
  - **Redirect Authorization Header Preservation**: HTTP 3xx 리다이렉트 발생 시 `Authorization` 헤더가 누락되지 않도록 `redirect: 'manual'` 후 수동 추적 또는 헤더 유지 요청 수행.
  - **Transparent Error Response**: 4xx, 5xx 에러나 네트워크 수신 결과를 숨기지 않고 실제 HTTP Status Code, Status Text, Body 데이터를 그대로 Return하여 UI Response Viewer에 투명하게 출력.

---

### [PostTool Component & Hooks (`components/PostTool.tsx`, `hooks/useRequestRunner.ts`)]

#### [MODIFY] [PostTool.tsx](file:///K:/Antigravity_Projects/gitbase/happytool_electron/components/PostTool.tsx)
- `handleSend` 시 URL 변경에 따른 Host 헤더 자동 동기화 및 3xx/4xx/5xx 응답 데이터 바인딩 보완.
- Response Viewer가 status code (401, 403, 302, 200 등)와 시간(ms), Response Header, Body를 투명하게 표시하도록 예외 블록 개선.

#### [MODIFY] [useRequestRunner.ts](file:///K:/Antigravity_Projects/gitbase/happytool_electron/hooks/useRequestRunner.ts)
- CLI 및 Runner 모드에서도 동일하게 Host Header Sanitize 및 Proxy response error unwrapping 로직 적용.

---

## 검증 계획 (Verification Plan)

### 자동 및 수동 테스트 (Automated & Manual Tests)
- `scratch/test_st_deep.cjs` 기반으로 Host 헤더 조작 및 Redirection 상황에서의 헤더 유지 테스트 수행.
- PostTool UI에서 `https://client.stacceptance.com/locations` 요청 시 200 OK 또는 올바른 HTTP 응답(Response Header 및 Body)이 정확히 렌더링되는지 확인.
