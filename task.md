# Task: 원본 보기 가상화 및 제한 해제

원본 보기(Raw Log View)에서 로그 줄 수 제한을 없애고 가상화를 통해 성능을 최적화합니다.

## 세부 작업 내용
- [x] `workers/PerfTool.worker.ts`: 2,000줄 추출 제한 제거 및 개별 줄 길이 제한 상향 (5,000자)
- [x] `components/PerfTool/index.tsx`: `PerfRawViewer`에 `react-virtuoso` 가상화 적용
- [x] `components/PerfTool/index.tsx`: 초기 스크롤 로직을 가상화 기반으로 변경
- [x] UI 스타일링 개선 (강조 표시 및 줄 번호 가독성)
