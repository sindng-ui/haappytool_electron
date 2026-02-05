# Json Tool Copy 버튼 복원

## 작업 내용
사용자 요청에 따라 Json Format 도구에서 사라진 Copy 버튼을 복원했습니다.

## 변경 사항
- `components/JsonTools/JsonFormatter.tsx` 수정
  - 유효한 JSON 결과가 있을 때 표시되는 툴바 영역에 'Format Copy' 및 'Minify & Copy' 버튼을 추가했습니다.
  - 기존에 주석으로 남아있던 `{/* ... Controls for Tool Mode ... */}` 위치에 구현체를 삽입했습니다.

## 기능 확인
- JSON을 입력하고 Beautify를 실행하면 우측 패널 상단에 복사 아이콘(Copy)과 축소 아이콘(Minify)이 나타납니다.
- 각 버튼 클릭 시 클립보드에 결과가 복사됩니다.
