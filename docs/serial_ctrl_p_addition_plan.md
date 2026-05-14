# 구현 계획: Serial 퀵 커맨드 Ctrl+P 추가

형님, Serial 연결 시 사용하는 퀵 커맨드 창에 `Ctrl+P` 버튼을 추가하여 편의성을 높이겠습니다.

## 1. 주요 변경 사항

### 📂 components/LogViewer/QuickCommandPanel.tsx
- `System Actions` 섹션의 그리드 레이아웃을 `grid-cols-2` -> `grid-cols-3`로 변경합니다.
- 단일 `Ctrl+P` 발송을 위한 버튼을 추가합니다.
- 버튼 구성:
  1. **BREAK** (Ctrl+P) - *신규 추가 (녹색 계열)*
  2. **UNLOCK** (Ctrl+P x2)
  3. **RE-ACT** (Ctrl+P x3)

## 2. 작업 상세

### QuickCommandPanel.tsx 수정
```tsx
<div className="grid grid-cols-3 gap-1 p-1">
    <button 
        onClick={() => onSpecialKey('ctrl_p')}
        className="flex flex-col items-center justify-center p-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/30 text-emerald-300 transition-all active:scale-95"
    >
        <span className="text-[10px] font-black uppercase">Break</span>
        <span className="text-[8px] opacity-60">Ctrl+P</span>
    </button>
    <button 
        onClick={() => onSpecialKey('ctrl_p_twice')}
        className="flex flex-col items-center justify-center p-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 text-indigo-300 transition-all active:scale-95"
    >
        <span className="text-[10px] font-black uppercase">Unlock</span>
        <span className="text-[8px] opacity-60">Ctrl+P x2</span>
    </button>
    <button 
        onClick={() => onSpecialKey('ctrl_p_thrice')}
        className="flex flex-col items-center justify-center p-2 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 text-purple-300 transition-all active:scale-95"
    >
        <span className="text-[10px] font-black uppercase">Re-Act</span>
        <span className="text-[8px] opacity-60">Ctrl+P x3</span>
    </button>
</div>
```

## 3. 사후 관리
- `APP_MAP.md` 파일에 인터페이스 변경 사항 업데이트

형님, 이대로 진행해도 괜찮을까요? 괜찮으시다면 `Proceed` 라고 말씀해 주세요! 🐧
