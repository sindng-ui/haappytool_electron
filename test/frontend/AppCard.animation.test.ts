import { describe, it, expect } from 'vitest';
import { getCardVariants } from '../../components/AppCard';

describe('AppCard Animation Specification Test', () => {
  const mockRandomFactor = { delay: 0.25, rotate: 3, x: 15 };

  it('🐧 등장(Entrance) 모드: 중후한 tween 애니메이션 사양을 지켜야 한다', () => {
    const variants = getCardVariants(mockRandomFactor, false);
    const transition = variants.visible.transition as any;

    expect(transition.type).toBe('tween');
    expect(transition.ease).toBe('easeOut');
    expect(transition.duration).toBe(0.5);
    // 엇박 감성 딜레이 체크 (0.1 + randomFactor.delay)
    expect(transition.delay).toBe(0.1 + mockRandomFactor.delay);
  });

  it('🐧 상호작용(Interaction) 모드: 번개 같은 spring 복귀 사양을 지켜야 한다', () => {
    const variants = getCardVariants(mockRandomFactor, true); // isEntered = true
    const transition = variants.visible.transition as any;

    expect(transition.type).toBe('spring');
    expect(transition.stiffness).toBe(500);
    expect(transition.damping).toBe(30);
    expect(transition.delay).toBeUndefined(); // 복귀 시에는 딜레이가 없어야 함
  });

  it('🐧 위치 사양: 초기 위치(hidden)는 y: 30이어야 하며, 최종 위치(visible)는 y: 0이어야 한다', () => {
    const variants = getCardVariants(mockRandomFactor, false);
    
    expect(variants.hidden.y).toBe(30);
    expect(variants.visible.y).toBe(0);
    expect(variants.hidden.scale).toBe(0.9);
    expect(variants.visible.scale).toBe(1);
  });
});
