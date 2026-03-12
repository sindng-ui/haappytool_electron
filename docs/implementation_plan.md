# Summary 탭 리스트 전환 애니메이션 추가 계획

형님, Analyze Diff의 Summary 탭에서 상단 카테고리 버튼(Regressions, Improvements, Stable)을 누를 때 하단 리스트가 너무 뚝뚝 끊기며 바뀌는 문제를 해결하기 위해 부드러운 전환 효과를 추가하겠습니다.

## Proposed Changes

### [SplitAnalyzerPanel.tsx]

`summaryFilter` 상태가 변경될 때 컴포넌트 전체가 다시 그려지는 것이 아니라, 리스트 영역만 `framer-motion`의 `AnimatePresence`와 `motion.div`를 사용하여 애니메이션 효과를 부여합니다.

#### [MODIFY] SplitAnalyzerPanel.tsx
- 리스트 컨테이너를 `motion.div`로 감싸고 `key={summaryFilter}`를 부여합니다.
- `initial`, `animate`, `exit` 속성을 사용하여 좌/우 슬라이딩 및 페이드 효과를 적용합니다.

```tsx
<AnimatePresence mode="wait">
    <motion.div
        key={summaryFilter}
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -10, opacity: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="flex-1 overflow-y-auto custom-scrollbar p-1 flex flex-col gap-1"
    >
        {/* 리스트 렌더링 로직 */}
    </motion.div>
</AnimatePresence>
```

## 기대 효과 🐧✨
- 카테고리 전환 시 시각적으로 리스트가 교체되는 느낌이 명확해지고 앱이 훨씬 고급스러워집니다.
- `mode="wait"`를 사용하여 이전 리스트가 사라진 후 새 리스트가 나타나므로 겹쳐 보이는 현상 없이 깔끔하게 전환됩니다.

<button>Proceed</button>
