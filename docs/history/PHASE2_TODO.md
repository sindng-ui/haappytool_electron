# Phase 2 작업 계획 - LogExtractor 개선

## 완료된 Phase 1 작업 ✅
1. Configuration 접기 버튼 z-index 조정 (z-30)
2. 로그 뷰어 폰트 및 시인성 개선 (index.css)
   - Consolas, SF Mono, Monaco 폰트 스택
   - 라인 높이 1.6
   - 더 밝은 텍스트 색상 (#e2e8f0)

## Phase 2 작업 목록 (진행 필요)

### 1. 앱 실행시 마지막 파일 자동 로드
**구현 방법:**
- localStorage에 `lastOpenedLogFile` 저장
- 파일명과 경로를 저장 (보안상 경로는 저장 안할 수도 있음)
- 앱 시작시 localStorage에서 로드하여 자동으로 열기

**수정할 위치:**
- LogExtractor.tsx의 파일 로드 핸들러에 localStorage.setItem() 추가
- useEffect로 컴포넌트 마운트시 localStorage.getItem() 및 자동 로드

### 2. 키보드 단축키 구현
**필요한 단축키:**
- `Shift + 마우스 스크롤` → 양쪽 pane 동시 스크롤 (이미 구현됨!)
- `Shif + Arrow Up/Down` → 양쪽 pane 1줄씩 스크롤
- `Page Up/Down` → 현재 포커스된 pane 페이지 스크롤
- `Ctrl + Arrow Up/Down` → 1줄씩 스크롤 
- `Ctrl + Left/Right Arrow` → 좌/우 pane 포커스 이동

**수정할 위치:**
- LogViewerPane의 handleKeyDown 함수 확장
- 전역 키보드 이벤트 리스너 추가 (useEffect)

### 3. Bookmark 가로 스크롤시 고정 표시
**구현 방법:**
- Bookmark 아이콘 컨테이너에 `position: sticky` 추가
- `left: 0` 및 `z-index: 20` 설정
- 배경색 추가 (`bg-slate-950`)

**수정할 위치:** (라인 367-369)
```tsx
// 현재:
<div className="w-4 flex items-center justify-center shrink-0 mr-1">
    {bookmarks.has(virtualIndex) && <Bookmark size={10} className="text-indigo-400 fill-indigo-400" />}
</div>

// 수정 후:
<div className="sticky left-0 w-4 flex items-center justify-center shrink-0 mr-1 bg-slate-950 z-20">
    {bookmarks.has(virtualIndex) && <Bookmark size={10} className="text-indigo-400 fill-indigo-400" />}
</div>
```

## 현재 문제점
- **LogExtractor.tsx가 1412줄로 너무 큼**
- 작은 수정도 파일 손상 위험이 높음
- **리팩토링이 시급함**

## 다음 세션 계획
1. **LogExtractor.tsx 리팩토링** 우선 진행
   - LogViewerPane → 별도 파일
   - ConfigurationPanel → 별도 파일  
   - TopBar → 별도 파일
2. 리팩토링 후 Phase 2 작업 진행 (훨씬 쉬워질 것)

## 참고 사항
- Shift + Wheel 동시 스크롤은 이미 구현되어 있음 (라인 256-272)
- Bookmark는 F3/F4로 네비게이션 가능 (이미 구현됨)
- 파일 저장/로드 Worker 방식으로 구현되어 있음
