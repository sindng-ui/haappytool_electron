# 로그 아카이브 (Log Archive) - 사용 가이드

## 📖 개요

**로그 아카이브**는 HappyTool의 LogExtractor에서 중요한 로그를 선택하여 저장하고, 나중에 쉽게 찾아볼 수 있는 기능입니다.

### 주요 기능

- 📝 **로그 선택 및 저장**: 마우스로 텍스트를 선택하여 즉시 저장
- 🔍 **고급 검색**: 일반 텍스트 및 RegEx 검색 지원
- 🏷️ **스마트 태그**: 자동 태그 추천 및 태그 기반 필터링
- 📊 **대용량 처리**: IndexedDB 기반으로 수만 개 이상 저장 가능
- ⚡ **고성능**: Worker Thread, 비동기 페이징, debounce 최적화

---

## 🚀 빠른 시작

### 1. 로그 저장하기

1. LogExtractor에서 저장하고 싶은 로그 텍스트를 **드래그하여 선택**
2. 선택 영역 근처에 나타나는 **"Save" 버튼 클릭** (또는 `Ctrl+S`)
3. 저장 다이얼로그에서:
   - **Title**: 제목 (자동 입력되지만 수정 가능)
   - **Tags**: 태그 입력 (추천 태그 활용)
   - **Enter** 키로 저장

### 2. 아카이브 보기

1. 상단 바의 **Archive 아이콘** 클릭
2. 우측 사이드바에서 저장된 로그 목록 확인
3. 원하는 로그 카드 클릭하여 상세 내용 보기

### 3. 검색하기

1. 사이드바 상단의 **검색바**에 검색어 입력
2. **RegEx 버튼**을 눌러 정규 표현식 검색 활성화
3. **필터 버튼**을 눌러:
   - 태그 필터링
   - 정렬 옵션 변경

---

## 💡 주요 기능 상세 가이드

### 📝 로그 저장

#### 방법 1: Floating Button
- 로그 텍스트 선택 시 자동으로 나타남
- 클릭하여 저장 다이얼로그 열기

#### 방법 2: 우클릭 메뉴
- 선택한 텍스트에서 마우스 우클릭
- "Save to Archive" 메뉴 선택

#### 방법 3: 키보드 단축키
- 텍스트 선택 후 `Ctrl+S` (또는 `Cmd+S`)

### 🏷️ 태그 시스템

#### 스마트 태그 추천
로그 내용을 분석하여 자동으로 태그를 추천합니다:

- **로그 레벨**: ERROR, WARNING, INFO, DEBUG
- **카테고리**: NETWORK, DATABASE, MEMORY, FILE_IO, AUTH, PERFORMANCE
- **시간**: 자동 날짜 태그 (YYYY-MM-DD), 시간대 태그 (MORNING, AFTERNOON 등)

#### 태그 입력 방법
1. 태그 입력창에 태그 이름 입력
2. `Enter` 키로 추가
3. 태그 칩의 `X` 버튼으로 제거
4. `Backspace` 키로 마지막 태그 제거

### 🔍 고급 검색

#### 일반 텍스트 검색
- 검색바에 검색어 입력
- 제목과 내용에서 모두 검색됨
- 1000ms debounce 적용 (입력 후 1초 대기)

#### RegEx 검색
1. 검색바 우측의 **`</>` 아이콘** 클릭하여 활성화
2. 정규 표현식 패턴 입력 (예: `error|fail|exception`)
3. 매칭되는 항목만 필터링

#### 태그 필터
1. 검색바 우측의 **슬라이더 아이콘** 클릭
2. 원하는 태그 선택 (복수 선택 가능)
3. 선택한 태그를 **모두 포함**하는 항목만 표시 (AND 조건)

#### 정렬 옵션
- **Created Date** (생성일) - 기본값
- **Updated Date** (수정일)
- **Title** (제목)
- Descending (내림차순) / Ascending (오름차순)

### 📊 아카이브 뷰어

로그 카드 클릭 시 하단에 상세 뷰어가 표시됩니다:

#### 주요 정보
- 제목 및 태그
- 생성 날짜/시간
- 라인 수
- 원본 파일 경로 (있는 경우)

#### 액션 버튼
- **📋 Copy**: 클립보드에 복사
- **🔗 Go to Source**: 원본 로그 파일로 이동 (구현 시)
- **🗑️ Delete**: 아카이브 삭제

### 📤 Export / Import

#### Export (내보내기)
1. 사이드바 상단의 **Actions 메뉴** (슬라이더 아이콘) 클릭
2. **Export JSON** 선택
3. JSON 파일 다운로드

#### Import (가져오기)
1. Actions 메뉴에서 **Import JSON** 선택
2. 이전에 Export한 JSON 파일 선택
3. 자동으로 아카이브에 추가됨

#### 전체 삭제
- Actions 메뉴에서 **Clear All** 선택
- 확인 후 모든 아카이브 삭제

---

## ⚙️ 고급 설정

### 성능 최적화

#### Worker Thread
- 모든 DB 작업과 검색이 백그라운드에서 처리됨
- 메인 UI가 절대 블로킹되지 않음

#### 비동기 페이징
- 한 번에 50개씩만 로드
- 스크롤 하단 도달 시 자동으로 추가 로드
- 수만 개의 아카이브도 부드럽게 스크롤 가능

#### 검색 Debounce
- 검색 입력 후 1000ms 대기
- 불필요한 검색 실행 방지
- CPU 및 메모리 효율성 향상

### 데이터베이스

#### IndexedDB (Dexie.js)
- 브라우저 로컬 스토리지 사용
- 용량 제한: 브라우저에 따라 다르지만 일반적으로 수 GB
- 자동 인덱싱으로 빠른 검색 성능

#### 인덱스
- `id`: Auto-increment 기본 키
- `title`: 제목 인덱스
- `tags`: Multi-entry 인덱스 (배열의 각 요소 개별 인덱싱)
- `createdAt`: 생성일 인덱스
- `sourceFile`: 원본 파일 인덱스

---

## 🎨 UI/UX 가이드

### 키보드 단축키

| 단축키 | 동작 |
|--------|------|
| `Ctrl+S` | 선택한 텍스트 저장 |
| `Enter` | 저장 다이얼로그에서 태그 추가 |
| `Ctrl+Enter` | 저장 다이얼로그에서 저장 |
| `Esc` | 모달/사이드바 닫기 |
| `Backspace` | 태그 입력창에서 마지막 태그 제거 |

### 반응형 디자인
- 데스크톱: 사이드바 너비 450px
- 모바일: 사이드바 전체 화면 (100vw)

### 애니메이션
- Floating Button: 0.2s fade-in
- 사이드바: 0.3s slide-in
- 모달: 0.2s scale + fade
- 카드 hover: 0.15s transform

---

## 🔧 개발자 가이드

### 컴포넌트 구조

```
components/LogArchive/
├── db/
│   └── LogArchiveDB.ts          # Dexie 데이터베이스
├── hooks/
│   ├── useLogArchive.ts         # CRUD Hook
│   ├── useArchiveSearch.ts      # 검색 Hook
│   └── useLogSelection.ts       # 텍스트 선택 Hook
├── workers/
│   └── ArchiveSearch.worker.ts  # 검색 Worker
├── LogArchiveProvider.tsx       # Context Provider
├── FloatingActionButton.tsx     # 저장 버튼
├── SaveArchiveDialog.tsx        # 저장 모달
├── ArchiveSearchBar.tsx         # 검색바
├── ArchiveCard.tsx              # 카드 컴포넌트
├── ArchiveList.tsx              # 목록 컴포넌트
├── ArchiveSidebar.tsx           # 사이드바
├── ArchiveViewerPane.tsx        # 뷰어 패널
├── utils.ts                     # 유틸리티 함수
├── LogArchive.css               # 스타일시트
└── index.tsx                    # 메인 컴포넌트
```

### 데이터 모델

```typescript
interface ArchivedLog {
  id?: number;                    // Auto-increment
  title: string;                  // 제목
  content: string;                // 로그 내용
  tags: string[];                 // 태그 배열
  sourceFile?: string;            // 원본 파일 경로
  sourceLineStart?: number;       // 원본 시작 라인
  sourceLineEnd?: number;         // 원본 끝 라인
  createdAt: number;              // 생성 타임스탬프
  updatedAt?: number;             // 수정 타임스탬프
  metadata?: {
    highlightMatches?: string[];  // 하이라이트 키워드
    folder?: string;              // 폴더 분류
    color?: string;               // 사용자 색상
  };
}
```

### API 예제

#### 아카이브 저장
```typescript
const { saveArchive } = useLogArchive();

await saveArchive({
  title: '에러 로그',
  content: 'Error: Connection timeout...',
  tags: ['ERROR', 'NETWORK'],
  sourceFile: '/path/to/log.txt',
  sourceLineStart: 100,
  sourceLineEnd: 150,
});
```

#### 검색
```typescript
const { search, results, loadMore } = useArchiveSearch();

// 일반 검색
await search({ query: 'error' });

// RegEx 검색
await search({ 
  query: 'error|fail|exception', 
  isRegex: true 
});

// 태그 필터
await search({ 
  tags: ['ERROR', 'NETWORK'],
  sortBy: 'createdAt',
  sortOrder: 'desc'
});

// 무한 스크롤
await loadMore();
```

---

## 🐛 트러블슈팅

### Q: 아카이브가 저장되지 않아요
**A**: 브라우저의 IndexedDB가 활성화되어 있는지 확인하세요. 시크릿 모드에서는 제한될 수 있습니다.

### Q: 검색이 느려요
**A**: 
- 검색어 입력 후 1초 대기 (debounce)
- RegEx 패턴이 너무 복잡한지 확인
- 브라우저 콘솔에서 에러 확인

### Q: 사이드바가 열리지 않아요
**A**: 
- 브라우저 콘솔에서 JavaScript 에러 확인
- LogArchiveProvider가 올바르게 설정되어 있는지 확인

### Q: Floating Button이 나타나지 않아요
**A**:
- 텍스트를 올바르게 선택했는지 확인
- LogExtractor 내부의 로그 영역에서 선택했는지 확인
- useLogSelection Hook이 활성화되어 있는지 확인

---

## 📝 향후 계획

### Phase 2 (예정)
- 폴더/그룹 기능
- 원본 로그 연동 (Go to Source)
- 하이라이트 기능
- 공유 기능 (URL 생성)

### Phase 3 (예정)
- AI 기반 로그 분석
- 통계 대시보드
- 클라우드 동기화
- 협업 기능

---

## 📄 라이선스

HappyTool 프로젝트의 일부로 동일한 라이선스가 적용됩니다.

---

## 👥 기여

버그 리포트, 기능 제안, Pull Request를 환영합니다!

**작성일**: 2026-02-09  
**작성자**: Antigravity  
**버전**: 1.0
