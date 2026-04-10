# 텍스트 선택하여 저장하기 - 통합 가이드

## 📍 현재 상태

✅ Archive 버튼 추가됨 (LogExtractor 헤더)
✅ LogArchive 기능 완전 구현됨
❌ **텍스트 선택 시 Floating Button 미연결**

---

## 🎯 목표

로그 뷰어에서 텍스트를 마우스로 드래그 선택하면:
1. 선택 영역 근처에 **"Save" 버튼이 나타남**
2. 버튼 클릭 → **저장 다이얼로그 열림**
3. 제목, 태그, 폴더, 컬러 선택 후 저장

---

## 📝 통합 방법

### 방법 1: LogSession.tsx 수정 (권장)

**파일**: `components/LogSession.tsx`

#### 1단계: 이미 추가된 import 확인

```tsx
// ✅ 이미 추가됨 (line 12-13)
import { useLogSelection } from './LogArchive/hooks/useLogSelection';
import { FloatingActionButton } from './LogArchive/FloatingActionButton';
```

#### 2단계: 이미 추가된 Hook 확인

```tsx
// ✅ 이미 추가됨 (line 97-99)
// Log Archive: Text Selection
const logContentRef = React.useRef<HTMLDivElement>(null);
const { selection, handleSave: handleArchiveSave } = useLogSelection(logContentRef, undefined);
```

#### 3단계: div에 ref 추가 (line 655)

**변경 전**:
```tsx
<div className="flex-1 flex overflow-hidden h-full relative group/layout">
```

**변경 후**:
```tsx
<div ref={logContentRef} className="flex-1 flex overflow-hidden h-full relative group/layout">
```

#### 4단계: FloatingActionButton 추가 (line 883 직전)

**BookmarksModal 바로 위에 추가**:

```tsx
            {/* Log Archive: Floating Action Button */}
            {selection && (
                <FloatingActionButton
                    selection={selection}
                    onSave={handleArchiveSave}
                />
            )}

            {/* Bookmarks Modals */}
            <BookmarksModal
```

---

## 🔧 전체 수정 예시

### LogSession.tsx 수정 위치

```tsx
// Line 655: ref 추가
<div ref={logContentRef} className="flex-1 flex overflow-hidden h-full relative group/layout">

// ... 기존 코드 ...

// Line 883 직전: FloatingActionButton 추가
            </GoToLineModal>

            {/* ===== 여기에 추가 ===== */}
            {/* Log Archive: Floating Action Button */}
            {selection && (
                <FloatingActionButton
                    selection={selection}
                    onSave={handleArchiveSave}
                />
            )}
            {/* ===== 추가 끝 ===== */}

            {/* Bookmarks Modals */}
            <BookmarksModal
                isOpen={isLeftBookmarksOpen}
```

---

## ✅ 완료 후 테스트

1. **앱 재시작**: `npm run electron:dev`
2. **로그 파일 열기**
3. **텍스트 선택**: 마우스로 여러 줄 드래그
4. **버튼 확인**: 선택 영역 근처에 파란색 "Save Selection" 버튼이 나타나야 함
5. **저장**: 버튼 클릭 → 다이얼로그 → 저장

---

## 🎨 동작 방식

### 1. 텍스트 선택 감지
- `useLogSelection` Hook이 `logContentRef` 내부의 텍스트 선택을 감지
- 선택 시 `selection` 객체가 생성됨:
  ```typescript
  {
    content: "선택된 텍스트",
    sourceFile: "file.log",
    startLine: 100,
    endLine: 150
  }
  ```

### 2. FloatingActionButton 표시
- `selection`이 존재하면 버튼이 자동으로 나타남
- 마우스 커서 근처에 absolute positioning으로 표시
- 애니메이션: framer-motion으로 부드럽게 나타남

### 3. 저장 다이얼로그
- 버튼 클릭 → `handleArchiveSave()` 호출
- SaveArchiveDialog가 열리며 선택된 텍스트가 미리 입력됨
- 사용자가 제목, 태그, 폴더, 컬러 선택 후 저장

---

## 🐛 문제 해결

### 1. 버튼이 안 나타남
**원인**: ref가 제대로 연결 안됨
**해결**: `logContentRef`가 올바른 div에 추가되었는지 확인

### 2. 선택은 되는데 버튼이 안 보임
**원인**: FloatingActionButton이 렌더링 안됨
**해결**: `{selection && ...}` 조건이 올바른지 확인

### 3. 클릭해도 다이얼로그가 안 열림
**원인**: LogArchiveProvider가 연결 안됨
**해결**: App.tsx에 LogArchiveProvider가 있는지 확인 (✅ 이미 추가됨)

---

## 📊 현재 파일 상태

### ✅ 준비 완료
- `App.tsx`: LogArchiveProvider 추가됨
- `LogExtractor.tsx`: Archive 버튼 추가됨
- `LogSession.tsx`: useLogSelection Hook 추가됨 (import, ref, hook 호출)

### ❌ 추가 필요
- `LogSession.tsx` Line 655: `ref={logContentRef}` 추가
- `LogSession.tsx` Line 883 직전: `<FloatingActionButton>` 추가

---

## 💡 참고

### 대안: 브라우저 콘솔로 테스트

텍스트 선택 기능 없이도 Archive 기능을 테스트할 수 있습니다:

```javascript
// F12 → Console
const LogArchiveDB = await import('/src/components/LogArchive/db/LogArchiveDB.js');
const db = LogArchiveDB.db;

// 직접 저장
await db.saveArchive({
  title: "수동 저장 테스트",
  content: "ERROR: Connection timeout\nRetry failed",
  tags: ["ERROR", "TEST"],
  metadata: { 
    folder: "Manual Tests", 
    color: "#ef4444" 
  }
});

// Archive 버튼 클릭하고 사이드바에서 확인!
```

---

**작성일**: 2026-02-09  
**상태**: LogSession.tsx 수정 2단계만 남음
