import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Scene } from '../src/game/Scene.js';

describe('Scene (Spec 014 §2)', () => {
  it('is unchanged by default, as focus mode draws it (Spec 006)', () => {
    const { container } = render(<Scene />);
    expect(container.querySelectorAll('i')).toHaveLength(36);
    expect(container.querySelectorAll('path')).toHaveLength(2);
    expect(container.querySelector('[data-testid="horizon"]')).toBeNull();
  });

  it('is richer on Home: more stars, a third hill and a glow on the horizon', () => {
    const { container } = render(<Scene rich />);
    expect(container.querySelectorAll('i').length).toBeGreaterThan(36);
    expect(container.querySelectorAll('path')).toHaveLength(3);
    expect(container.querySelector('[data-testid="horizon"]')).not.toBeNull();
  });
});
