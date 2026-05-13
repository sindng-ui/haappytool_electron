# 워크쓰루: 글로벌 로그 뷰어 줌 동기화

형님, 이제 모든 로그 탭이 한몸처럼 움직입니다! 🐧✨

## 🌟 주요 변화
- **실시간 동기화**: 어떤 탭에서 줌을 해도 모든 탭에 즉시 반영됩니다.
- **설정 보존**: 줌 레벨은 `localStorage`에 안전하게 저장되어 앱을 껐다 켜도 유지됩니다.
- **통합 관리**: `LogViewPreferencesContext`를 통해 폰트 크기, 줄 간격, 대시보드 높이 등을 한곳에서 관리합니다.

## 📸 변경된 부분
1. **Context**: `components/LogViewer/LogViewPreferencesContext.tsx` 추가
2. **Hook**: `hooks/useLogViewPreferences.ts` 리팩토링 (전역 컨텍스트 사용)
3. **App Structure**: `LogExtractor.tsx`에서 전역 프로바이더 주입

이제 편하게 줌 조절하면서 로그 분석하세요, 형님! 🚀🔥
