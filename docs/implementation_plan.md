# 회사 PC 빌드 에러 해결을 위한 추가 보안 계획

형님, 현재 PC에서는 빌드가 되지만 회사 PC에서 실패하는 현상을 해결하기 위해, Vite/Rollup의 모듈 해석 방식을 더 명시적이고 견고하게 수정하겠습니다.

## User Review Required
> [!IMPORTANT]
> 이 작업은 `vite.config.ts`를 다시 한 번 수정합니다. 수정 후 다시 한 번 회사 PC에서 빌드를 시도해 주셔야 합니다.

## Proposed Changes

### Build Configuration

#### [MODIFY] [vite.config.ts](file:///k:/Antigravity_Projects/gitbase/happytool_electron/vite.config.ts)
- `build.rollupOptions.external`에서 `react-markdown` 부류가 제외되어 있는지 재확인 (이미 제외되어 있다면 명시적 포함 방지).
- `resolve.alias`를 추가하여 `react-markdown`과 그 핵심 의존성들을 직접 `node_modules` 내부의 ESM 엔트리 포인트로 연결.
- `ssr.noExternal` 설정을 추가하여 빌드 시 해당 패키지들을 반드시 번들링에 포함시키도록 강제.

---

## Open Questions
- 형님, 회사 PC의 Node.js 버전과 현재 PC의 Node.js 버전이 혹시 다른지 알 수 있을까요? (예: 20 vs 22)
- 회사 PC에서 `npm run build`만 실행했을 때도 동일한 에러가 발생하는지 궁금합니다.

## Verification Plan

### Automated Tests
- `npm run build` (Vite 프로덕션 빌드) 실행 후 에러 여부 확인.
- `npm run electron:build` 실행 (형님께서 직접 확인 필요).

### Manual Verification
- 빌드된 바이너리에서 마크다운 보고서가 정상적으로 렌더링되는지 확인.
