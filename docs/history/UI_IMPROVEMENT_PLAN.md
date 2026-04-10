# 🎨 HappyTool UI 개선 계획

## 📋 현재 상태 분석

### LogExtractor
- ✅ 탭 기반 UI
- ✅ 36px 고정 헤더 (h-9)
- ❌ 스크롤 불가
- ❌ 일관성 없는 스타일

### PostTool
- 확인 필요

### TPKExtractor
- 확인 필요

---

## 🎯 개선 목표

### 1. 통일된 Title Bar ⭐
- **높이**: 40px (h-10) 통일
- **스타일**: 공통 디자인 시스템
- **구성**: [아이콘] [제목] [액션 버튼들]

### 2. 스크롤 가능한 Title Bar 🔄
- Horizontal scroll for tabs
- Smooth scrolling
- Hide scrollbar (보기 좋게)

### 3. UI 일관성 📐
- 색상 팔레트 통일
- 간격/여백 표준화
- 애니메이션 표준화

### 4. 유려한 느낌 ✨
- Smooth transitions (200ms)
- Subtle shadows
- Hover effects
- Micro-animations

### 5. 편의성 개선 🚀
- Drag tabs to reorder
- Keyboard shortcuts indicator
- Quick actions menu
- Context menu

---

## 🛠️ 구현 계획

### Phase 1: 공통 컴포넌트 (30분)
1. **TitleBar 컴포넌트** 생성
   - 재사용 가능한 title bar
   - Props: title, icon, actions, scrollable

2. **디자인 토큰** 정의
   - colors.ts
   - spacing.ts
   - animations.ts

### Phase 2: LogExtractor 개선 (20분)
1. 새 TitleBar 적용
2. 탭 스크롤 개선
3. 애니메이션 추가

### Phase 3: PostTool 개선 (20분)
1. TitleBar 통일
2. 레이아웃 개선

### Phase 4: TPKExtractor 개선 (15분)
1. TitleBar 통일
2. 일관성 확보

### Phase 5: 전체 폴리싱 (15분)
1. 애니메이션 조정
2. 색상 조화
3. 최종 테스트

---

## 🎨 디자인 시스템

### Colors
```css
--bg-primary: #0f172a (slate-950)
--bg-secondary: #1e293b (slate-900)
--bg-tertiary: #334155 (slate-800)

--accent-primary: #6366f1 (indigo-500)
--accent-hover: #818cf8 (indigo-400)
--accent-active: #4f46e5 (indigo-600)

--text-primary: #f1f5f9 (slate-100)
--text-secondary: #cbd5e1 (slate-300)
--text-muted: #94a3b8 (slate-400)

--border-default: rgba(99, 102, 241, 0.3)
--border-subtle: rgba(255, 255, 255, 0.1)
```

### Spacing
```css
--spacing-xs: 4px
--spacing-sm: 8px
--spacing-md: 12px
--spacing-lg: 16px
--spacing-xl: 24px
```

### Animations
```css
--transition-fast: 150ms ease
--transition-normal: 200ms ease
--transition-slow: 300ms ease
```

---

## ✨ 새로운 기능

### 1. Drag & Drop Tab Reordering
- 탭 순서 변경 가능
- 부드러운 애니메이션

### 2. Keyboard Shortcuts
- Ctrl+T: 새 탭
- Ctrl+W: 탭 닫기
- Ctrl+Tab: 다음 탭
- Ctrl+Shift+Tab: 이전 탭

### 3. Context Menu
- 우클릭 메뉴
- 탭 복제
- 모든 탭 닫기
- 다른 탭 닫기

### 4. Quick Actions
- Floating action button
- 자주 쓰는 기능 빠른 접근

---

## 🚀 성능 고려사항

### ✅ 최적화 방법
1. **CSS Transform 사용** - GPU 가속
2. **useCallback/useMemo** - 리렌더링 방지
3. **Virtual Scrolling** - 많은 탭 대응
4. **Debounce** - 과도한 이벤트 방지

### ❌ 피해야 할 것
1. ~~Heavy animations~~ → Subtle만
2. ~~Excessive re-renders~~ → Memoization
3. ~~Large bundle size~~ → Native CSS

---

## 📝 체크리스트

- [ ] TitleBar 공통 컴포넌트
- [ ] 디자인 토큰 정의
- [ ] LogExtractor 개선
- [ ] PostTool 개선
- [ ] TPKExtractor 개선
- [ ] Drag & Drop
- [ ] Context Menu
- [ ] Keyboard Shortcuts
- [ ] 애니메이션 폴리싱
- [ ] 최종 테스트

---

**예상 소요 시간**: 약 1.5시간  
**우선순위**: Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5  
**시작 시간**: 2026-01-30 02:45 KST
