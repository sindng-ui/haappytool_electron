import { describe, it, expect } from 'vitest';
import { getCardVariants } from '../../components/AppCard';

describe('AppCard Animation Specification Test', () => {
  const idx = 5;

  it('🐧 등장(Entrance) 사양: 프리미엄 Spring 애니메이션 사양을 지켜야 한다', () => {
    const variants = getCardVariants(idx);
    const transition = variants.visible.transition as any;

    expect(transition.type).toBe('spring');
    expect(transition.stiffness).toBe(180);
    expect(transition.damping).toBe(22);
    expect(transition.mass).toBe(0.8);
    // 곡선형 순차 지연 (Organic Stagger) 체크
    expect(transition.delay).toBe(Math.pow(idx, 0.7) * 0.05);
  });

  it('🐧 위치 및 변형 사양: 초기 상태(hidden)는 입체적인 깊이감을 가져야 한다', () => {
    const variants = getCardVariants(idx);
    
    expect(variants.hidden.y).toBe(40);
    expect(variants.visible.y).toBe(0);
    expect(variants.hidden.scale).toBe(0.85);
    expect(variants.visible.scale).toBe(1);
    expect(variants.hidden.opacity).toBe(0);
  });
});
