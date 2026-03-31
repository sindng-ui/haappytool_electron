// workers/LogIndexer.worker.ts
/* eslint-disable no-restricted-globals */
const ctx: Worker = self as any;

// 🐧 팁: 네이티브 indexOf(10) (LF)을 사용하여 JS 루프보다 수십 배 빠르게 줄 바꿈을 탐지합니다.
ctx.onmessage = async (e: MessageEvent) => {
  const { file } = e.data;
  if (!file) return;

  const fileSize = file.size;
  let capacity = 1024 * 1024; // 초기 100만 라인 확보
  let offsets = new Uint32Array(capacity);
  offsets[0] = 0; // 첫 번째 줄은 0바이트부터 시작
  let lineCount = 1;

  const stream = file.stream();
  const reader = stream.getReader();
  let totalProcessed = 0;

  try {
    console.log(`[LogIndexer] Starting index for: ${file.name} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
    const startTime = performance.now();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk: Uint8Array = value;
      let pos = -1;
      
      // ASCII 10 은 '\n' (Line Feed) 입니다.
      while ((pos = chunk.indexOf(10, pos + 1)) !== -1) {
        if (lineCount >= capacity) {
          const newCapacity = capacity * 2;
          const newArr = new Uint32Array(newCapacity);
          newArr.set(offsets);
          offsets = newArr;
          capacity = newCapacity;
        }
        // 다음 줄의 시작 위치 = 현재 청크 내 LF 위치 + 지금까지 읽은 총 바이트 수 + 1
        offsets[lineCount++] = totalProcessed + pos + 1;
      }
      totalProcessed += chunk.length;
    }
    
    const duration = performance.now() - startTime;
    console.log(`[LogIndexer] Indexing complete: ${lineCount.toLocaleString()} lines in ${duration.toFixed(2)}ms`);

    ctx.postMessage({ 
      type: 'INDEX_COMPLETE', 
      payload: { 
        offsets: offsets.subarray(0, lineCount),
        totalLines: lineCount 
      } 
    });
  } catch (err: any) {
    console.error('[LogIndexer] Indexing failed:', err);
    ctx.postMessage({ type: 'ERROR', payload: err.message });
  }
};
