# Implementation Plan - SmartThings Presentation Dictionary UI Fixes (v2)

> **목적**: SmartThings Presentation Dictionary 플러그인의 검색창 아이콘 겹침, 드롭다운 화이트아웃, 그리고 자글자글한 카테고리 테두리 해결 및 **돋보기 아이콘의 보더 침범/위치 탈출 오류 보정**.

---

## 🛠️ 주요 이슈 진단 및 해결 방향

### 1. 돋보기 아이콘 위치 이탈 및 보더라인 침범 해결 (`index.tsx`)
* **원인**: `left-3.5` 스타일이 지정되어 둥근 입력창 테두리(`rounded-xl`) 경계와 겹치면서 돋보기 아이콘이 테두리 밖으로 반쯤 삐져나옴.
* **해결책**:
  - `Search` 아이콘에 `style={{ left: '1rem', top: '50%', transform: 'translateY(-50%)' }}`을 명시하여 보더 안쪽 안전영역에 정확하게 칼정렬되도록 강제 배치합니다.

---

## 📅 작업 진행 동의 (Proceed)

형님, 돋보기 위치 오류를 완벽하게 인지하고 보정할 준비가 끝났습니다!
승인해 주시면 즉시 코드 수정을 완료하겠습니다. 🐧✨
