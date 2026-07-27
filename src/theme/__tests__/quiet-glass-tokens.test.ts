import { glass, palette } from '../tokens';

describe('Quiet Glass design contract', () => {
  it('uses the approved warm neutral palette', () => {
    expect(palette.background).toBe('#FBF7F2');
    expect(palette.ink).toBe('#221F1A');
    expect(palette.inkSoft).toBe('#6B655B');
    expect(palette.inkMuted).toBe('#8A8378');
    expect(palette.sage).toBe('#7E9174');
    expect(palette.clay).toBe('#C1875F');
  });

  it('keeps cards translucent with a bright glass edge', () => {
    expect(glass.fill).toBe('rgba(255,255,255,0.65)');
    expect(glass.edge).toBe('rgba(255,255,255,0.80)');
  });
});
