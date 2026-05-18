# 🚀 Speed Scope Analyzer - Top 10 Heavy Hitters 접이식 패널 구현 계획서

형님! Speed Scope Analyzer 플러그인 로드 시 상단의 **Top 10 Heavy Hitters** 영역이 높이를 너무 많이 차지하여 메인 타임라인/Flame Graph 차트 영역을 가리는 문제를 해결하기 위한 최종 구현 계획서입니다. 🐧⚡

---

## 🎯 요구 사항 및 개선 방향
1. **화면 영역 최적화**: 
   - 기본 상태(Default)에서는 Heavy Hitters 패널이 접힌(Collapsed) 콤팩트한 30px 높이의 한 줄짜리 헤더 바 형태로만 렌더링되게 하여, 타임라인 및 차트의 넓은 영역을 최우선으로 확보합니다.
2. **부드러운 열기/접기 인터랙션**:
   - 사용자가 헤더 영역을 클릭하면 `framer-motion` 기반의 매우 실키하고 부드러운 슬라이딩 스프링 트랜지션으로 10개의 병목 카드들이 뿅 펼쳐지게 처리합니다.
   - 우측에는 직관적인 Chevron (`Lucide.ChevronDown`) 화살표 회전 애니메이션과 안내 텍스트가 상태에 따라 유기적으로 전환되도록 구성합니다.

---

## 🛠️ 상세 아키텍처 및 구현 내용

### 1) [PerfHeavyHitters.tsx](file:///k:/Antigravity_Projects/gitbase/happytool_electron/components/LogViewer/PerfDashboard/PerfHeavyHitters.tsx)
- **Local Collapsible State**: `const [isCollapsed, setIsCollapsed] = useState(true);` 상태를 신설해 컴포넌트 마운트 시 기본적으로 접힘 상태로 유지합니다.
- **Premium Clickable Header**: 
  - 헤더 영역 전체를 클릭 가능(`cursor-pointer select-none`)하게 설정하고, 마우스 호버 시 은은한 배경 오버레이 효과(`hover:bg-white/5`)와 active 인터랙션을 적용했습니다.
  - 우측의 기능 안내 문구가 `isCollapsed` 상태에 따라 `[Click to Expand]` (은은한 인디고 펄스) ↔ `Identify direct CPU bottlenecks` (슬레이트 회색)로 실시간 토글되게 하였습니다.
- **Smooth Sliding Dropdown**:
  - `AnimatePresence` 및 `motion.div`를 사용하여 높이(`height: 0` ↔ `auto`), 투명도(`opacity: 0` ↔ `1`)를 스프링 곡선(`stiffness: 300, damping: 30`)으로 제어하여 브라우저 리플로우가 느껴지지 않을 정도로 아름답게 접히고 펼쳐지도록 완성했습니다!

---

형님! 이제 프로파일 로딩 직후 넓고 시원시원해진 Speed Scope 메인 타임라인 화면을 즐기실 수 있으며, 병목 상세 조회가 필요할 때만 헤더를 살짝 눌러 럭셔리하게 카드를 펼쳐볼 수 있습니다! 🐧🔥🚀
