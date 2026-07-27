# PipelineEditor.tsx 500줄 초과 관련 리팩토링 계획서 📋

> [!WARNING]
> `PipelineEditor.tsx` 파일이 현재 **1,373줄**로 500줄 제한 규정을 초과하고 있습니다.  
> 코드의 가독성, 수정을 용이하게 하기 위한 분할 리팩토링 계획을 제출합니다.

## 분할 리팩토링 방안

### 1. `PipelineBlockNode.tsx` 분리 (약 250 lines)
- `BlockNode` 컴포넌트를 독립된 파일로 분리.
- Special Block (Sleep, Touch, Log Start/Stop, Wait Image 등) 노드 렌더링 로직 캡슐화.

### 2. `PipelineGraphFlow.tsx` 분리 (약 300 lines)
- `GraphFlow`, `LoopNode`, `ConditionalNode` 등 파이프라인 그래프의 구조적 계층 렌더링 로직 분리.

### 3. `usePipelineCanvas.ts` 마이크로 훅 분리 (약 200 lines)
- Pan & Zoom 상태, 마우스 드래그 이동, 캔버스 스케일링 로직을 커스텀 훅으로 추출.

### 4. 경량화된 `PipelineEditor.tsx` (목표: ~350 lines)
- 메인 툴바, 캔버스 콘테이너, Undo/Redo 연동 및 모달 오케스트레이션 역할만 전담.
