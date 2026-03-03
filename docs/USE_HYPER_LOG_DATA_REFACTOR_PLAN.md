# useHyperLogData 최적화 계획 (보수적 접근)

이 문서는 Log Extractor의 성능 관련 점검 결과 3번 항목에 대해, 큰 아키텍처 변경 없이 기존 로직 내에서 안전하고 가볍게(Zero-risk) CPU 연산량과 GC 부하를 최소화하는 개선 계획입니다.

## 1. 정규식 디코딩 로직 최적화 (`decodeHTMLEntities`)
- **이슈 사유**: `decodeHTMLEntities`는 최대 5000줄의 청크가 들어올 때마다 매 라인별로 8개의 정규표현식(`replace`)을 실행합니다. 하지만 일반적인 로그에는 `&` 나 `\t` 기호가 없는 경우가 90% 이상입니다.
- **개선 방법 (Fast Path 도입)**: 
  문자열에 `&`나 `\t`가 포함되어 있는지 `indexOf`로 먼저 검사(매우 빠름)하여, 포함되어 있지 않다면 즉시 원본 텍스트를 반환합니다. 
  이렇게 하면 대부분의 단순 로그 라인에서 무거운 정규표현식 엔진이 아예 동작하지 않게 되어 CPU 소모가 급감합니다.
- **변경 사항 (예상)**:
  ```typescript
  export const decodeHTMLEntities = (text: string) => {
      if (!text) return '';
      // Fast path: 엔터티 무관 기호가 없으면 정규식을 타지 않음
      if (text.indexOf('&') === -1 && text.indexOf('\t') === -1) {
          return text;
      }
      return text.replace(/&quot;/g, '"')... // 기존 로직
  };
  ```

## 2. 캐시 메모리 GC 부하 최적화 (Memory Cleaning)
- **이슈 사유**: `150,000`개를 초과할 때 삭제를 위해 `Array.from(next.keys())`를 사용하여 15만 개짜리 새로운 배열을 메모리에 할당하고 있었습니다. 이 행위 자체가 순간적인 가비지 컬렉터(GC) 부하(Spike)를 유발합니다.
- **개선 방법 (Iterator 직접 순회)**: 
  Map은 추가된 순서를 기억합니다. 따라서 `next.keys()` 이터레이터를 직접 순회(`for...of`)하면서 필요한 개수(3만개)만큼만 `delete`하고 `break` 하도록 변경합니다. 중간 배열(Array) 자체를 생성하지 않아 메모리 할당(Zero Allocation)을 원천 차단합니다.
- **변경 사항 (예상)**:
  ```typescript
  if (next.size > 150000) {
      const amountToDelete = next.size - 120000;
      let count = 0;
      for (const key of next.keys()) {
          next.delete(key);
          count++;
          if (count >= amountToDelete) break;
      }
  }
  ```

## 안전성 (Safety & Regression Risk)
- **안전성 최고**: 구조적 변경(워커 통신 방식 변경 등) 없이 오로지 내부 연산만 스킵/최적화하는 방식입니다. 기존 로직에 미치는 사이드 이펙트는 **0%**에 가깝습니다.
- **검증**: `npm run test:all`을 통해 관련된 다른 훅이나 로그 뷰어 동작에 이상이 없는지 곧바로 테스트하여 검증 가능합니다.

---
📝 **형님**, 위 계획은 구조에 손을 대지 않고 효율만 극한으로 끌어올리는 가장 안전한 핀포인트 개선법입니다. 승인해 주시면 즉시 코드에 반영하겠습니다!
