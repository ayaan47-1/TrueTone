import { glass, palette } from '../tokens';

describe('Quiet Glass design contract', () => {
  it('uses the approved warm neutral palette', () => {
    expect(palette.background).toBe('#faf7f2');
    expect(palette.ink).toBe('#221F1A');
    expect(palette.inkSoft).toBe('#6B655B');
    expect(palette.inkMuted).toBe('#8A8378');
    expect(palette.sage).toBe('#2f7d52');
    expect(palette.clay).toBe('#c26a4a');
  });

  it('keeps cards translucent with a bright glass edge', () => {
    expect(glass.fill).toBe('rgba(255,255,255,0.65)');
    expect(glass.edge).toBe('rgba(255,255,255,0.80)');
  });
});
