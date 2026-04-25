# 🐧 JSZip 번들 로딩 TypeError 해결 계획서

형님! `nupkgUtils.test.ts`에서 발생하는 JSZip 번들 관련 에러를 잡고 진짜 100% 성공을 찍겠습니다!

## 1. 문제 분석
- **에러 메시지**: `TypeError: Cannot set property default of [object Module] which has only a getter`
- **원인**: `jszip-bundle.js`는 브라우저/워커 환경을 위해 번들링된 파일인데, Vitest(Node.js) 환경에서 이를 `import`로 가져올 때 내부적으로 `module.exports` 등을 처리하는 과정에서 읽기 전용 속성을 덮어쓰려다 실패하는 것으로 보입니다.

## 2. 해결 전략
- **전략 A (가장 권장)**: 테스트 환경(`vitest`)에서는 번들 파일 대신 `node_modules`에 있는 실제 `jszip` 패키지를 사용하도록 별칭(alias)을 설정하거나 직접 임포트 경로를 수정합니다.
- **전략 B**: 테스트 파일에서 `jszip-bundle.js`를 불러올 때 `vi.mock`을 사용하여 안정적인 Mock 객체로 대체합니다.

## 3. 상세 작업 단계
1.  **파일 분석**: `test/components/NupkgSigner/nupkgUtils.test.ts` 내용을 확인합니다.
2.  **경로 수정**: 테스트 코드에서 `vendor/jszip-bundle.js`를 직접 참조하고 있다면, 이를 `jszip` 패키지 참조로 변경합니다.
3.  **검증**: `wsl npm run test -- test/components/NupkgSigner/nupkgUtils.test.ts` 명령으로 해당 파일이 통과하는지 확인합니다.

형님, 바로 진행해도 될까요? 🐧🔥
