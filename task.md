# Log Extractor 투명도 설정 추가

## 작업 내용
사용자 요청에 따라 Log Extractor의 View Settings에 Log Level 투명도(Opacity) 조절 기능을 추가했습니다.

## 변경 사항
- **`types.ts`**: `LogViewPreferences` 인터페이스에 `logLevelOpacity` (number, 0-100) 필드 추가.
- **`components/LogViewer/ConfigSections/ViewSettingsSection.tsx`**: Log Level Colors 항목 위에 투명도 조절 슬라이더(Input Range) 추가. (기본값 20%)
- **`components/LogViewer/LogLine.tsx`**: 하드코딩된 투명도(`33` aka ~20%) 대신 설정된 `logLevelOpacity` 값을 기반으로 Alpha Hex 값을 계산하여 적용하도록 수정.

## 기능 확인
- Configuration > View Settings 섹션 확인.
- "Opacity" 슬라이더 조절 시 Log Level 색상(Verbose, Debug 등)의 배경색 투명도가 실시간으로 변경되는지 확인.
- 기본값 20%에서 적절히 표시되는지 확인.
