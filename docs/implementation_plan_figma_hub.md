# Figma Style App Hub & Mega Library 구현 계획서

## 🎯 목표 (Objective)
기존의 좌측 사이드바(Sidebar)를 완전히 제거하여 화면 가로폭을 100% 확보하고, Figma 스타일의 플로팅 'Top-Left Hub'와 화면 전체를 덮는 거대한 'Mega App Library 모달'을 도입하여 트렌디하고 생산성 높은 앱 전환 경험을 제공합니다.

## 📐 아키텍처 및 디자인 설계
1. **Zero-Sidebar Layout**: `App.tsx`에서 사이드바가 차지하던 영역을 완전히 제거합니다. 로그 뷰어 등 플러그인이 모니터 가로 전체를 사용할 수 있게 됩니다.
2. **App Hub (플로팅 톱 네비게이션)**: 화면 좌측 상단에 떠 있는 작고 세련된 버튼. 현재 활성화된 앱의 아이콘과 이름이 표시되며, 클릭 시 앱 라이브러리가 열립니다.
3. **App Library Modal (메가 스토어)**: 화면 전체를 반투명(Glassmorphism)하게 덮는 모달. 플러그인들을 'Core Apps'와 'Labs Apps' 섹션으로 명확히 구분하여 아름다운 카드(Grid) 형태로 나열합니다.
4. **Settings (설정)**: 사이드바 하단에 있던 설정 버튼은 우측 상단의 플로팅 버튼으로 이동하거나 App Library 내부에 배치합니다.

## 🛠️ 단계별 구현 계획 (Phase-by-Phase Plan)

### Phase 1: 신규 UI 컴포넌트 생성
- [ ] `components/AppHub.tsx` 생성: 화면 좌측 상단에 고정(`absolute top-4 left-4 z-50`)되는 둥글고 예쁜 플로팅 버튼 컴포넌트 개발.
- [ ] `components/AppLibraryModal.tsx` 생성: `AppHub` 클릭 시 나타나는 전체 화면 모달 개발.
  - 모달 내부에 `Core Apps` (기본 플러그인)와 `Labs Apps` (실험실 플러그인) 섹션을 명확히 구분.
  - 각 플러그인을 선택하기 쉬운 큼직한 타일/카드 형태로 렌더링.
- [ ] `components/TopRightActions.tsx` 생성 (옵션): 우측 상단에 설정(Settings) 버튼 등을 위치시킬 플로팅 컨테이너.

### Phase 2: App.tsx 레이아웃 전면 개편
- [ ] `App.tsx`에서 기존 `<Sidebar />` 컴포넌트 제거.
- [ ] 메인 레이아웃의 Flex 컨테이너 수정 (사이드바 여백 제거, 가로폭 100% 사용).
- [ ] `<AppHub>` 및 `<TopRightActions>` 통합.
- [ ] `AppLibraryModal` 상태(open/close) 관리 로직 추가.

### Phase 3: 기존 사이드바 관련 코드 정리 및 스타일 폴리싱
- [ ] 더 이상 사용되지 않는 `components/Sidebar.tsx` 삭제.
- [ ] 각 컴포넌트의 Solid Dark 테마에 맞춘 세밀한 스타일링 (백드롭 블러, 보더, 호버 애니메이션).
- [ ] 앱 전환 시의 부드러운 트랜지션 애니메이션 확인.
- [ ] `APP_MAP.md` 파일을 최신 인터페이스 맵에 맞게 업데이트.

## ⚠️ 주의 사항
- `Log Extractor` 등 기존 플러그인의 내부 UI 요소가 좌측 상단 플로팅 버튼(`AppHub`)에 가려지지 않도록, 플러그인 렌더링 영역 상단에 약간의 여백(`pt-16` 등)을 추가할지, 각 플러그인이 알아서 헤더 밑에 위치하게 할지 조율해야 합니다.
- 윈도우 환경(WSL)에서의 빌드 에러가 발생하지 않도록 의존성을 최소화하고 순수 React + TailwindCSS로 구현합니다.

---
**유저 확인 대기 중...**
형님, 위 계획이 마음에 드신다면 **[Proceed]** (진행해) 라고 말씀해 주십쇼! 바로 코딩 시작하겠습니다.
