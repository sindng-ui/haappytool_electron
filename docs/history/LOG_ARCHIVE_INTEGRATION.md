# 로그 아카이브 사용 방법

## ✅ 설치 완료!

로그 아카이브 기능이 **App.tsx에 전역으로 통합**되었습니다! 🎉

---

## 📍 통합 위치

### App.tsx
```tsx
// Provider 계층 구조
<ToastProvider>
  <CommandProvider>
    <LogArchiveProvider>  ← 추가됨!
      <AppContent />
    </LogArchiveProvider>
  </CommandProvider>
</ToastProvider>

// 렌더링 
<CommandPalette />
<LogArchive />  ← 추가됨!
```

---

## 🚀 사용 방법

### 방법 1: Command Palette로 열기 (추천)

1. `Ctrl+K` 또는 `Cmd+K`로 Command Palette 열기
2. "Archive" 검색
3. 아카이브 관련 명령 실행

> **Note**: Command Palette에 아카이브 명령을 등록하려면 `CommandRegistrar`에 추가가 필요합니다.

### 방법 2: 프로그래밍 방식으로 사용

아무 컴포넌트에서나 LogArchive 기능을 사용할 수 있습니다:

```tsx
import { useLogArchiveContext } from './components/LogArchive';

function MyComponent() {
  const { 
    openSidebar,      // 사이드바 열기
    openSaveDialog,   // 저장 다이얼로그 열기
    openViewer        // 뷰어 열기
  } = useLogArchiveContext();

  // 예: 버튼 클릭 시 저장
  const handleSave = () => {
    openSaveDialog({
      content: "로그 내용...",
      sourceFile: "/path/to/log.txt",
      startLine: 100,
      endLine: 150
    });
  };

  // 예: 버튼 클릭 시 아카이브 목록 열기
  const handleOpenArchive = () => {
    openSidebar();
  };

  return (
    <>
      <button onClick={handleSave}>Save Log</button>
      <button onClick={handleOpenArchive}>Archives</button>
    </>
  );
}
```

### 방법 3: LogExtractor에 통합

LogExtractor 컴포넌트에 아카이브 버튼을 추가하려면:

```tsx
// LogExtractor.tsx
import { Archive } from 'lucide-react';
import { useLogArchiveContext } from './LogArchive';

const LogExtractor = () => {
  const { toggleSidebar } = useLogArchiveContext();

  return (
    <div>
      {/* 헤더에 Archive 버튼 추가 */}
      <header>
        <button onClick={toggleSidebar} title="Open Archives">
          <Archive size={20} />
        </button>
      </header>
      
      {/* 나머지 LogExtractor 내용 */}
    </div>
  );
};
```

---

## 🎯 추천: Command Palette 명령 등록

App.tsx의 `CommandRegistrar` 컴포넌트에 아카이브 명령을 추가하세요:

```tsx
// App.tsx의 CommandRegistrar에 추가
import { Archive, BarChart3, Save } from 'lucide-react';

useEffect(() => {
  // ... 기존 명령들 ...

  // 아카이브 사이드바 열기
  registerCommand({
    id: 'open-archive',
    title: 'Open Log Archive',
    section: 'Log Archive',
    icon: <Archive size={18} />,
    action: () => {
      // LogArchiveContext에서 openSidebar 호출
      // Context를 CommandRegistrar에서 사용하려면 별도 hook 필요
    },
    keywords: ['archive', 'logs', 'history'],
    shortcut: 'Ctrl+Shift+A'
  });

  // 통계 대시보드 열기
  registerCommand({
    id: 'open-archive-stats',
    title: 'Open Archive Statistics',
    section: 'Log Archive',
    icon: <BarChart3 size={18} />,
    action: () => {
      // 통계 대시보드를 모달이나 별도 페이지로 표시
    },
    keywords: ['stats', 'statistics', 'analytics']
  });

  return () => {
    unregisterCommand('open-archive');
    unregisterCommand('open-archive-stats');
  };
}, [registerCommand, unregisterCommand]);
```

---

## 📁 주요 기능 사용 예시

### 1. 로그 저장하기

```tsx
import { useLogArchiveContext } from './components/LogArchive';

const { openSaveDialog } = useLogArchiveContext();

// 선택된 텍스트 저장
openSaveDialog({
  content: "ERROR: Connection timeout...",
  sourceFile: "/logs/error.log",
  startLine: 120,
  endLine: 135
});
```

### 2. 저장 시 폴더와 컬러 지정

```tsx
import { useLogArchive } from './components/LogArchive';

const { saveArchive } = useLogArchive();

await saveArchive({
  title: "Critical Production Error",
  content: "ERROR: Database connection failed...",
  tags: ["ERROR", "CRITICAL", "DATABASE"],
  metadata: {
    folder: "Production Issues",  // 폴더 지정
    color: "#ef4444"              // 빨간색 라벨
  }
});
```

### 3. 검색하기

```tsx
import { useArchiveSearch } from './components/LogArchive';

const { search, results, loadMore } = useArchiveSearch();

// 텍스트 검색
await search({ query: "error" });

// RegEx 검색
await search({ 
  query: "error|fail|exception", 
  isRegex: true 
});

// 폴더 + 태그 필터
await search({ 
  folder: "Production Issues",
  tags: ["ERROR", "CRITICAL"],
  sortBy: 'createdAt',
  sortOrder: 'desc'
});

// 더 많은 결과 로드 (무한 스크롤)
await loadMore();
```

### 4. 통계 대시보드

```tsx
import { StatisticsDashboard } from './components/LogArchive';

// 별도 페이지나 모달에서 표시
function StatsPage() {
  return (
    <div style={{ height: '100vh' }}>
      <StatisticsDashboard />
    </div>
  );
}
```

---

## 🎨 UI 컴포넌트 설명

### 1. FloatingActionButton
- 텍스트 선택 시 자동으로 나타남
- 현재는 자동 표시 안됨 (useLogSelection Hook 연결 필요)

### 2. SaveArchiveDialog
- 저장 모달 (제목, 태그, 폴더, 컬러)
- 키보드: `Enter` (태그 추가), `Ctrl+Enter` (저장), `Esc` (닫기)

### 3. ArchiveSidebar
- 우측 슬라이딩 드로어
- 검색, 필터링, Export/Import

### 4. ArchiveViewerPane
- 하단 상세 뷰어
- 복사, 원본 이동, 삭제

### 5. StatisticsDashboard
- 통계 대시보드
- 4가지 차트 + 요약 카드

---

## 🔧 추가 작업 (선택 사항)

### A. LogExtractor에 텍스트 선택 기능 추가

```tsx
// LogExtractor.tsx 또는 LogSession.tsx
import { useLogSelection } from './LogArchive/hooks/useLogSelection';

const LogSession = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { selection, handleSave } = useLogSelection(
    containerRef, 
    currentFilePath
  );

  return (
    <div ref={containerRef}>
      {/* 로그 내용 */}
      
      {/* Floating Button */}
      {selection && (
        <FloatingActionButton 
          selection={selection}
          onSave={handleSave}
        />
      )}
    </div>
  );
};
```

### B. Command Palette Helper Hook

LogArchiveContext를 Command Palette에서 사용하기 위한 Helper:

```tsx
// components/LogArchive/hooks/useArchiveCommands.ts
import { useEffect } from 'react';
import { useCommand } from '../../contexts/CommandContext';
import { useLogArchiveContext } from '../LogArchiveProvider';
import { Archive, BarChart3 } from 'lucide-react';

export function useArchiveCommands() {
  const { registerCommand, unregisterCommand } = useCommand();
  const { toggleSidebar } = useLogArchiveContext();

  useEffect(() => {
    registerCommand({
      id: 'toggle-archive',
      title: 'Toggle Log Archive',
      section: 'Log Archive',
      icon: <Archive size={18} />,
      action: toggleSidebar,
      shortcut: 'Ctrl+Shift+A'
    });

    return () => {
      unregisterCommand('toggle-archive');
    };
  }, [registerCommand, unregisterCommand, toggleSidebar]);
}
```

그 다음 AppContent에서 사용:

```tsx
// App.tsx의 AppContent 내부
import { useArchiveCommands } from './components/LogArchive/hooks/useArchiveCommands';

const AppContent = () => {
  // ... 기존 코드 ...
  
  useArchiveCommands(); // 아카이브 명령 등록
  
  return (/* ... */);
};
```

---

## ✅ 체크리스트

- [x] App.tsx에 Provider 추가
- [x] App.tsx에 컴포넌트 렌더링
- [ ] Command Palette 명령 등록
- [ ] LogExtractor에 Archive 버튼 추가
- [ ] 텍스트 선택 기능 연결
- [ ] 테스트 및 검증

---

## 🎉 완료!

이제 앱의 어디서든 로그 아카이브를 사용할 수 있습니다!

**실행 중인 dev 서버에서 바로 확인 가능합니다.** 브라우저 콘솔에서 다음과 같이 테스트할 수 있습니다:

```javascript
// React DevTools Console에서
// LogArchiveContext를 사용하는 컴포넌트를 선택하고
$r.context.openSidebar() // 사이드바 열기
```

또는 **로그 아카이브 DB 직접 테스트**:

```javascript
import { db } from './components/LogArchive/db/LogArchiveDB';

// 샘플 데이터 저장
await db.saveArchive({
  title: "Test Archive",
  content: "Test content...",
  tags: ["TEST"],
  metadata: { folder: "Test", color: "#3b82f6" }
});

// 통계 확인
const stats = await db.getStatisticsSummary();
console.log(stats);
```

---

**작성일**: 2026-02-09  
**버전**: 2.1 (App.tsx 통합 완료)
