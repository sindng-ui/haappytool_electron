# 로그 아카이브 기능 구현 계획

## 📋 개요

LogExtractor에 로그 선택 및 저장, 검색, 태그 관리, 뷰어 기능을 제공하는 아카이브 시스템을 구축합니다.

## 🎯 핵심 목표

1. **대용량 처리**: Dexie.js 기반 IndexedDB로 수만 개 이상의 로그 저장
2. **성능 최적화**: Worker Thread, 비동기 페이징, debounce로 메인 스레드 영향 최소화
3. **직관적 UX**: Floating Button, Modal, Drawer, Split View로 매끄러운 워크플로우 제공
4. **고급 검색**: RegEx 지원, 태그 필터링, 전체 텍스트 검색

## 🏗️ 아키텍처 설계

### 1. 데이터베이스 스키마 (Dexie.js)

```typescript
// db/LogArchiveDB.ts
import Dexie, { Table } from 'dexie';

export interface ArchivedLog {
  id?: number; // Auto-increment primary key
  title: string;
  content: string; // 선택된 로그 텍스트
  tags: string[]; // 태그 배열
  sourceFile?: string; // 원본 파일 경로
  sourceLineStart?: number; // 원본 파일 시작 라인
  sourceLineEnd?: number; // 원본 파일 끝 라인
  createdAt: number; // 타임스탬프 (검색/정렬용)
  metadata?: {
    highlightMatches?: string[]; // 하이라이트할 키워드
    folder?: string; // 폴더 분류
  };
}

export class LogArchiveDB extends Dexie {
  archives!: Table<ArchivedLog, number>;

  constructor() {
    super('LogArchiveDB');
    this.version(1).stores({
      archives: '++id, title, *tags, sourceFile, createdAt, metadata.folder'
      // ++id: auto-increment
      // *tags: multi-entry index (배열의 각 요소를 인덱싱)
      // createdAt: 정렬용 인덱스
    });
  }
}

export const db = new LogArchiveDB();
```

### 2. Worker Thread 구조

```
ArchiveSearch.worker.ts
├─ 검색 쿼리 처리 (RegEx, Full-text)
├─ 태그 필터링
├─ 페이징 처리 (50개씩)
└─ 결과 반환
```

**주요 메시지 타입**:
- `SEARCH_ARCHIVES`: 검색 요청
- `GET_ARCHIVES_PAGE`: 페이징 요청
- `GET_ALL_TAGS`: 모든 태그 목록 조회
- `DELETE_ARCHIVE`: 아카이브 삭제

### 3. 컴포넌트 구조

```
components/
├─ LogArchive/
│  ├─ LogArchiveProvider.tsx         # Context Provider (상태 관리)
│  ├─ FloatingActionButton.tsx       # 선택 시 나타나는 버튼
│  ├─ SaveArchiveDialog.tsx          # 저장 모달
│  ├─ ArchiveSidebar.tsx             # 우측 드로어
│  │  ├─ ArchiveSearchBar.tsx        # 검색바 (RegEx 토글)
│  │  ├─ ArchiveList.tsx             # 카드 리스트
│  │  └─ ArchiveCard.tsx             # 개별 카드
│  ├─ ArchiveViewerPane.tsx          # 하단 Split View
│  ├─ hooks/
│  │  ├─ useLogArchive.ts            # 아카이브 CRUD 로직
│  │  ├─ useArchiveSearch.ts         # 검색 로직 (Worker 통신)
│  │  └─ useArchivePagination.ts     # 무한 스크롤 페이징
│  ├─ db/
│  │  └─ LogArchiveDB.ts             # Dexie 데이터베이스
│  └─ workers/
│     └─ ArchiveSearch.worker.ts     # 검색 워커
```

## 📐 상세 구현 계획

### Phase 1: 데이터베이스 및 기본 CRUD (우선순위: 높음)

#### 1.1 데이터베이스 설정
- [x] Dexie.js 스키마 정의
- [x] 인덱스 설정 (tags, createdAt, sourceFile)
- [x] 마이그레이션 전략 수립

#### 1.2 Hook 구현 (`useLogArchive`)
```typescript
interface UseLogArchiveReturn {
  saveArchive: (data: Partial<ArchivedLog>) => Promise<number>;
  updateArchive: (id: number, data: Partial<ArchivedLog>) => Promise<void>;
  deleteArchive: (id: number) => Promise<void>;
  getArchive: (id: number) => Promise<ArchivedLog | undefined>;
  getAllTags: () => Promise<string[]>;
}
```

### Phase 2: UI - 저장 워크플로우 (우선순위: 높음)

#### 2.1 Selection 감지 및 FloatingActionButton
- `LogExtractor` 또는 `LogViewerPane`에서 텍스트 선택 감지
- `window.getSelection()` 사용
- 선택 영역 근처에 Floating Button 렌더링 (Framer Motion)
- 우클릭 메뉴에 "Save to Archive" 추가

#### 2.2 SaveArchiveDialog
- Modal UI (overlay + 중앙 정렬)
- 필드:
  - **Title**: 선택된 로그의 첫 줄 자동 입력 (편집 가능)
  - **Tags**: Chip 형태 입력 (기존 태그 자동완성)
  - **Folder** (선택): 폴더 분류
- UX:
  - Enter: 저장
  - Esc: 닫기
  - 비동기 저장 (로딩 스피너)

### Phase 3: UI - Archive Sidebar (우선순위: 높음)

#### 3.1 Sliding Drawer
- 우측에서 슬라이드인되는 드로어 (`framer-motion`)
- 토글 버튼 (LogExtractor 상단 바에 배치)

#### 3.2 ArchiveSearchBar
- 검색 입력창 (1000ms debounce)
- RegEx 토글 버튼
- 태그 필터 (멀티 선택)
- 정렬 옵션 (최신순, 제목순, 태그순)

#### 3.3 ArchiveList (무한 스크롤)
- `react-virtuoso` 사용
- 50개씩 페이징
- 각 아이템은 `ArchiveCard`

#### 3.4 ArchiveCard
```tsx
<Card>
  <Title>{archive.title}</Title>
  <Tags>{archive.tags.map(tag => <Chip>{tag}</Chip>)}</Tags>
  <Timestamp>{formatDate(archive.createdAt)}</Timestamp>
  <Actions>
    <IconButton icon="Eye" onClick={onView} />
    <IconButton icon="Edit" onClick={onEdit} />
    <IconButton icon="Trash" onClick={onDelete} />
  </Actions>
</Card>
```

### Phase 4: UI - Archive Viewer Pane (우선순위: 중간)

#### 4.1 Split View 레이아웃
- LogExtractor에 Split View 추가
- 상단: 기존 LogViewerPane
- 하단: ArchiveViewerPane (토글 가능)

#### 4.2 ArchiveViewerPane
- Syntax Highlighting (기존 로그 하이라이팅 재사용)
- RegEx 검색 결과 강조
- 액션 버튼:
  - 📋 클립보드 복사
  - 🔗 원본 로그로 이동 (sourceFile + sourceLineStart)
  - ✏️ 편집
  - 🗑️ 삭제

### Phase 5: 검색 및 성능 최적화 (우선순위: 높음)

#### 5.1 ArchiveSearch.worker.ts
```typescript
self.addEventListener('message', async (e) => {
  const { type, payload } = e.data;

  switch (type) {
    case 'SEARCH_ARCHIVES':
      const { query, isRegex, tags, page, pageSize } = payload;
      let results = await searchArchives(query, isRegex, tags);
      const paginatedResults = results.slice(page * pageSize, (page + 1) * pageSize);
      self.postMessage({ type: 'SEARCH_RESULTS', payload: paginatedResults });
      break;

    case 'GET_ALL_TAGS':
      const tags = await getAllUniqueTags();
      self.postMessage({ type: 'ALL_TAGS', payload: tags });
      break;
  }
});
```

#### 5.2 검색 전략
- **Full-text 검색**: Dexie `where().startsWith()` + `filter()`
- **RegEx 검색**: Worker에서 `new RegExp()` 생성 후 필터링
- **태그 필터**: Multi-entry 인덱스 활용
- **인덱싱**: `createdAt`, `tags`, `title` 인덱스 사용

#### 5.3 페이징 최적화
- 초기 로드: 50개
- 스크롤 하단 도달 시 추가 50개 로드
- `react-virtuoso`의 `endReached` 콜백 활용

#### 5.4 Debounce
- 검색창: 1000ms debounce
- 저장: 즉시 실행

### Phase 6: 고급 기능 (우선순위: 낮음)

#### 6.1 원본 로그 연동
- `sourceFile`, `sourceLineStart` 저장
- "Go to Source" 버튼 클릭 시:
  - 파일 로드 (이미 로드된 경우 재사용)
  - 해당 라인으로 스크롤
  - 하이라이트 표시

#### 6.2 스마트 태그 자동 추천
```typescript
function suggestTags(content: string): string[] {
  const suggestions: string[] = [];
  if (/error|fail|exception/i.test(content)) suggestions.push('ERROR');
  if (/warn/i.test(content)) suggestions.push('WARNING');
  if (/info|debug/i.test(content)) suggestions.push('INFO');
  
  // 날짜 기반 태그
  const today = new Date().toISOString().split('T')[0];
  suggestions.push(today);
  
  return suggestions;
}
```

#### 6.3 Export/Import
- JSON 파일로 내보내기
- 다른 환경에서 가져오기
- 선택 항목만 내보내기 가능

#### 6.4 통계 대시보드
- 태그별 저장 수 차트 (`recharts`)
- 시간별 저장 트렌드
- 가장 많이 검색된 태그

## 🔍 성능 최적화 체크리스트

### Worker Thread
- [x] 모든 DB IO는 Worker에서 처리
- [x] 검색 연산도 Worker에서 처리
- [x] 메인 스레드는 UI 렌더링만 담당

### 비동기 페이징
- [x] 50개씩 페이징
- [x] 무한 스크롤 (`react-virtuoso`)
- [x] 가상 스크롤링으로 DOM 노드 최소화

### Debounce
- [x] 검색: 1000ms
- [x] 태그 필터: 500ms

### 메모화
- [x] `React.memo`로 ArchiveCard 최적화
- [x] `useMemo`로 검색 결과 캐싱
- [x] `useCallback`으로 이벤트 핸들러 안정화

### IndexedDB 최적화
- [x] 복합 인덱스 사용
- [x] Multi-entry 인덱스 (tags)
- [x] 필요한 필드만 조회 (`select`)

## 🎨 UI/UX 디자인 가이드

### 색상 테마
- Primary: `#3b82f6` (파란색)
- Success: `#10b981` (녹색)
- Danger: `#ef4444` (빨간색)
- Background: `#1e293b` (다크)
- Card: `#334155`

### 애니메이션
- Floating Button: 0.2s ease-in-out
- Drawer: 0.3s slide-in
- Modal: 0.2s fade-in
- Card hover: 0.15s transform scale

### 반응형
- Drawer 너비: 350px (모바일: 100vw)
- Split View: 상단 60%, 하단 40% (조절 가능)

## 📅 구현 일정 (예상)

### Day 1-2: Phase 1 + Phase 2 (데이터베이스 + 저장 UI)
- 데이터베이스 스키마 및 CRUD Hook
- FloatingActionButton + SaveArchiveDialog
- 기본 저장 기능 완성

### Day 3-4: Phase 3 (Archive Sidebar)
- Sliding Drawer + SearchBar
- ArchiveList + ArchiveCard
- 무한 스크롤 페이징

### Day 5: Phase 4 (Viewer Pane)
- Split View 레이아웃
- ArchiveViewerPane
- 원본 로그 연동

### Day 6: Phase 5 (검색 최적화)
- ArchiveSearch.worker.ts
- RegEx 검색
- 성능 테스트 및 튜닝

### Day 7: Phase 6 (고급 기능)
- 스마트 태그 추천
- Export/Import
- 통계 대시보드 (선택)

### Phase 7: 타 플러그인 연동 (완료)
- [x] Post Tool (Response Viewer)
- [x] JSON Tools (Formatter, Diff Viewer)
- [x] Easy Post
- [x] AI Assistant (Chat Logs)
- [x] TPK Extractor (Terminal Logs)
- [x] Reverse Engineer (Context Menu)
- [x] 공통 Hook (`useTextSelectionMenu`) 개발 및 적용

## 🧪 테스트 전략

### 성능 테스트
- 10,000개 아카이브 저장 후 검색 성능 측정
- Worker Thread 응답 시간 모니터링
- 메모리 누수 체크

### 기능 테스트
- 저장/수정/삭제 CRUD 동작 확인
- RegEx 검색 정확도 테스트
- 태그 필터링 동작 확인
- 무한 스크롤 페이징 동작 확인

### UX 테스트
- 키보드 단축키 (Enter, Esc) 동작 확인
- Floating Button 위치 및 타이밍 확인
- 로딩 상태 표시 확인

## 🚀 배포 체크리스트

- [ ] Dexie.js 버전 확인 (이미 package.json에 포함)
- [ ] Worker 빌드 설정 확인 (vite.config.ts)
- [ ] TypeScript 타입 에러 없음
- [ ] 성능 테스트 통과 (10,000개 이상)
- [ ] 사용자 가이드 업데이트 (USER_GUIDE.md)

## 📚 참고 자료

- Dexie.js 공식 문서: https://dexie.org/
- React Virtuoso: https://virtuoso.dev/
- Framer Motion: https://www.framer.com/motion/
- IndexedDB Best Practices: https://web.dev/indexeddb-best-practices/

## 🔮 향후 확장 아이디어

1. **클라우드 동기화**: Firebase/Supabase와 연동하여 여러 기기 간 동기화
2. **협업 기능**: 팀원과 아카이브 공유
3. **AI 기반 분석**: 로그 패턴 자동 분석 및 인사이트 제공
4. **플러그인 시스템**: 커스텀 파서, 커스텀 뷰어 추가 가능
5. **알림 시스템**: 특정 패턴 감지 시 알림

---

**작성일**: 2026-02-09  
**작성자**: Antigravity  
**버전**: 1.0
