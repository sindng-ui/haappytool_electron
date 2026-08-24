# [구현 계획] PostTool 사내 프록시 연동 및 Acceptance 서버(client.acceptance.com) 네트워크 에러 해결 계획

형님! PostTool에서 Product 서버(`client.smartthings.com`)는 정상 작동하나 Acceptance 서버(`client.acceptance.com` 등)에서 `0 Network / Proxy Error`가 발생하는 현상과 원인을 완벽 분석하고 해결 계획을 정리했습니다. 🐧⚡

---

## 1. 문제 분석 및 근본 원인 (Root Cause)

> [!IMPORTANT]
> **왜 Postman은 되고 HappyTool에서는 에러가 발생했는가?**
>
> 1. **Node.js 내장 `fetch` (Undici)의 OS 시스템 프록시 미지원**:
>    - `electron/main.cjs`의 `proxyRequest`가 Node.js 내장 `global.fetch`를 호출하고 있었습니다.
>    - Node.js 내장 fetch는 Windows OS의 시스템 프록시(WinINet, PAC 스크립트, 기업 사내 프록시 등)를 자동으로 감지하거나 적용하지 못합니다.
>    - 따라서 프록시를 경유해야만 접근 가능한 Acceptance 서버(`client.acceptance.com`)로의 접근이 실패하여 `0 Network / Proxy Error`가 발생했습니다.
> 2. **Chromium 커맨드라인 스위치 오설정**:
>    - `electron/main.cjs` 22번째 줄에 `app.commandLine.appendSwitch('no-proxy-server', '127.0.0.1,localhost')`가 적용되어 있었습니다.
>    - Chromium의 `--no-proxy-server`는 인자를 받지 않는 "모든 프록시 완전 비활성화" 플래그입니다. 로컬호스트만 프록시에서 제외하려면 `--proxy-bypass-list=127.0.0.1;localhost;<local>`를 사용해야 합니다.
> 3. **사내 프록시 SSL/인증서 검증 이슈**:
>    - 사내 프록시 망에서 발생하는 사설 CA 인증서 또는 Acceptance 서버의 SSL 인증서 핸드셰이크 오류를 Chromium 네트워크 스택 레벨에서 안전하게 통과시켜야 합니다.

---

## 2. 해결 방안 (Proposed Architecture & Solution)

1. **Electron Chromium 네이티브 네트워크 스택 (`net.fetch`) 전면 도입**:
   - Node.js의 undici `fetch` 대신 Electron 21+부터 제공되는 `net.fetch` (`const { net } = require('electron');`)를 사용합니다.
   - `net.fetch`는 Postman이나 Chrome 브라우저와 동일하게 **OS 시스템 프록시(WinINet / PAC / 사내 프록시 설정)**를 100% 자동 감지 및 적용합니다.
   - CLI 환경 또는 테스트 환경 등 순수 Node.js 환경에 대비하여 `typeof net?.fetch === 'function' ? net.fetch : fetch` 형태의 안전한 Fallback 구조를 구현합니다.
2. **Chromium 프록시 및 SSL 플래그 정상화**:
   - `no-proxy-server` 오작동 스위치를 올바른 `proxy-bypass-list=127.0.0.1;localhost;<local>`로 수정합니다.
   - 사내 프록시 SSL 검증 오류 방지를 위해 `ignore-certificate-errors` 및 Electron `certificate-error` 이벤트 핸들러를 보강합니다.
3. **리다이렉트 및 헤더 보존 로직 유지**:
   - `net.fetch` 환경에서도 `Host` 헤더 Sanitize 및 3xx HTTP Redirection 시 `Authorization` 헤더 보존(`redirect: 'manual'`) 로직을 온전히 유지합니다.
4. **투명한 에러 진단 메시지 반환**:
   - 네트워크 연결 문제 발생 시 단순 "Proxy Request Failed" 대신 실제 에러 원인(`error.code`, `error.message`)을 UI에 전달하여 진단 편의성을 극대화합니다.

---

## 3. 제안하는 변경 사항 (Proposed Changes)

---

### [Electron Backend (`electron/main.cjs`)]

#### [MODIFY] [main.cjs](file:///K:/Antigravity_Projects/gitbase/happytool_electron/electron/main.cjs)
- **프록시 스위치 수정**:
  - `app.commandLine.appendSwitch('no-proxy-server', ...)` 제거
  - `app.commandLine.appendSwitch('proxy-bypass-list', '127.0.0.1;localhost;<local>')` 추가
  - `app.commandLine.appendSwitch('ignore-certificate-errors')` 추가
- **`net.fetch` 기반 `secureFetch` 헬퍼 함수 구현**:
  - Chromium 세션의 시스템 프록시/인증서를 100% 활용하는 `net.fetch`를 메인 요청 엔진으로 설정
- **`proxyRequest` IPC 핸들러 개선**:
  - `secureFetch`를 사용하여 OS 시스템 프록시를 통한 Acceptance 및 Prod 서버 요청 지원
  - Target URL Host와 다른 잔여 `Host` 헤더 자동 제거(Sanitize) 유지
  - HTTP 3xx 리다이렉트 시 `Authorization` 헤더 유지 로직(`redirect: 'manual'` 루프)과 결합
- **`fetchUrl` & `streamProxyRequest` IPC 핸들러 개선**:
  - 마찬가지로 `secureFetch`로 통일하여 시스템 프록시를 통해 모든 네트워크 요청이 원활하게 동작하도록 처리
- **인증서 에러 핸들러 추가**:
  - `app.on('certificate-error', ...)` 등록으로 사내 사설 인증서 통신 보장

---

### [Documentation & APP_MAP (`APP_MAP.md`, `docs/`)]

#### [MODIFY] [APP_MAP.md](file:///K:/Antigravity_Projects/gitbase/happytool_electron/APP_MAP.md) & [important/APP_MAP.md](file:///K:/Antigravity_Projects/gitbase/happytool_electron/important/APP_MAP.md)
- `PostTool` 및 Electron Network Stack 관련 인터페이스에 **Chromium `net.fetch` 기반 OS 시스템 프록시 자동 감지 및 사내 프록시 통신 지원** 내용 반영

#### [NEW] [docs/implementation_plan_stacceptance_proxy_fix.md](file:///K:/Antigravity_Projects/gitbase/happytool_electron/docs/implementation_plan_stacceptance_proxy_fix.md)
- 구현 계획 및 기술 명세서 저장

---

## 4. 검증 계획 (Verification Plan)

### Automated & Unit Tests
- `scratch/`에 `net.fetch` 및 프록시 동작 시뮬레이션 스크립트를 작성하여 테스트.
- 기존 PostTool 관련 Vitest 유닛 테스트 실행 및 통과 확인:
  ```bash
  npm run test:perf:post
  ```

### Manual Verification
- PostTool에서 `https://client.acceptance.com/...` 또는 사내 acceptance 도메인으로의 GET 요청 시, 더 이상 `0 Network / Proxy Error`가 발생하지 않고 사내 프록시를 통해 200 OK(또는 올바른 HTTP 응답)가 정상 반환되는지 확인.

---

형님, 위 계획을 검토해 주시고 승인(Proceed)해 주시면 신속하고 꼼꼼하게 코딩을 시작하겠습니다! 🐧✨
