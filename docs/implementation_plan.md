# App Hub 성능 개선 (Breakthrough Performance) 계획

## 1. 분석: 현재 느리고 버벅이는 원인 (List Up)

코드 분석 결과, App Hub가 열릴 때 노트북 등 저사양 기기에서 병목을 일으키는 주요 원인은 다음과 같습니다.

1. **Framer Motion `layout` 속성의 남용 (가장 큰 원인)**
   - `AppCard.tsx`와 `Section.tsx`에 `layout` 및 `layout="position"`이 적용되어 있습니다. 모달이 열릴 때 (최초 마운트 시점) 수십 개의 카드가 동시에 레이아웃 크기와 위치를 계산(Layout Thrashing)하게 되어 JS 스레드를 심각하게 차단합니다.
2. **초고부하 SVG Noise Filter (`feTurbulence`)**
   - `AppLibraryModal.tsx`의 배경에 아날로그 감성을 위해 추가된 `<svg><filter id="noiseFilter">...`는 실시간으로 프랙탈 노이즈 연산을 수행하므로 내장 그래픽(GPU)의 프레임 드랍을 유발합니다.
3. **과도한 GPU 레이어 (`transform-gpu`, `willChange`)**
   - 모든 `AppCard` 요소에 `transform-gpu`, `willChange: 'transform, opacity, filter'`가 강제되어 있습니다. 이로 인해 브라우저가 수십 개의 독립된 컴포지팅 레이어를 생성하게 되어 메모리와 VRAM을 낭비하고 역효과를 냅니다.
4. **무거운 Glassmorphism 및 Shadow**
   - 다수의 카드에 동시에 적용된 `backdrop-blur`, 복잡한 다중 `box-shadow`, `liquid-shine` 등의 효과가 렌더링 파이프라인에 부하를 줍니다.

---

## 2. 해결 계획 (Action Plan)

확실하고 획기적인 부드러움을 확보하기 위해 다음 항목들을 수정하겠습니다.

### [MODIFY] components/AppLibraryModal.tsx
- **SVG 노이즈 필터 제거**: 무거운 `<feTurbulence>` SVG 노이즈 필터를 완전히 삭제합니다. 감성을 유지하고 싶다면 CSS의 `background-image`를 활용한 아주 가벼운 정적 base64 패턴 이미지로 대체하거나, 노이즈 오버레이의 CSS 연산을 최소화합니다.
- **모달 애니메이션 간소화**: `willChange` 및 `transformStyle` 등 불필요하게 무거운 3D 속성을 제거하여 브라우저의 기본 컴포지터가 효율적으로 동작하게 합니다.

### [MODIFY] components/Section.tsx
- **`layout="position"` 제거**: 불필요한 레이아웃 애니메이션 연산을 없앱니다. 카드의 크기가 변경될 때 알아서 자연스럽게 밀려나도록 CSS Grid 속성만으로 맡깁니다.

### [MODIFY] components/AppCard.tsx
- **`layout` 속성 조건부 적용 (또는 제거)**: 카드가 처음 등장할 때는 `layout` 계산을 하지 않도록 아예 제거하거나, 우클릭으로 사이즈를 바꿀 때만 일시적으로 `layout`이 켜지도록 수정합니다.
- **레이어 및 이펙트 다이어트**:
  - `transform-gpu`와 `willChange: 'transform, opacity, filter'`를 삭제합니다. (호버링 시에만 브라우저가 가속하도록 둡니다)
  - `liquid-shine` 요소나 `backdrop-blur` 등 무거운 CSS는 `isActive` 상태이거나 `hover` 상태일 때만 켜지도록 최적화합니다.
  - 진입 애니메이션의 난수 기반 delay 로직은 유지하되, 너무 무거운 `filter` 애니메이션은 배제합니다.

## User Review Required
형님, 위 원인들을 제거하면 구형 노트북에서도 60fps로 매우 부드럽게 팝오버가 열리게 될 것입니다. 감성을 크게 해치지 않는 선에서 GPU를 괴롭히는 이펙트들(SVG 노이즈, 남용된 layout 계산 등)만 걷어내는 방향인데, 이대로 진행(Proceed) 할까요?
