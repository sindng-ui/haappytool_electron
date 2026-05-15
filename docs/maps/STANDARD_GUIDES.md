# 📜 Standard Guides

> **문서 분리 기준 (Threshold)**: 하위 항목이 100줄을 초과하거나 핵심 기능 명세가 5개 이상 쌓일 경우, 이 문서에서 분리하여 개별 파일로 관리하고 링크만 남깁니다.

### [Code Review Guide](file:///k:/Antigravity_Projects/gitbase/happytool_electron/important/CODE_REVIEW_GUIDE.md)
통합 코드 리뷰 시스템의 지침서입니다.
- **5대 핵심 지표**: App Perf, Change Perf, Regression, RAM & CPU, Big File.
- **Workflow**: `/code-review` 명령어 입력 시 가동되는 자동 분석 시스템.

### [Dependency Issues Guide](file:///k:/Antigravity_Projects/gitbase/happytool_electron/docs/DEPENDENCY_ISSUES.md) [NEW]
신규 node 모듈 추가 시 발생하는 환경 이슈(프록시, 빌드 에러)와 해결 사례를 모아놓은 지식 창고입니다.
- **주요 사례**: JSZip (Vite Worker & Proxy Conflict)
- **핵심 전략**: Public Vendor화, Runtime Loading, Type-Only Import.
- **Build & Reliability Enhancements (2026-04-22)**:
  - **JSZip Vendor Integration & ESM Patch**: `vendor/jszip-bundle.js` 번들을 프로젝트 내부 소스 코드로 탑재하여 Vite 빌드 시 ESM 파싱 오류 해결. (Global Alias 적용)
  - **Deep Clean Script**: `npm run clean:deep` 명령어로 빌드 찌꺼기 및 캐시 강제 삭제.
  - **Cross-Platform Startup Fix**: `npx cross-env` 도입.
  - **Zombie Port Cleanup**: 개발 포트(3000)를 점유하는 좀비 프로세스 자동 정리 로직 구축.

<br>

[🔼 메인 맵으로 돌아가기](../../APP_MAP.md)
