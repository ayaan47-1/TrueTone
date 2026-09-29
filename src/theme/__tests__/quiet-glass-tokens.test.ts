import { glass, palette, radii, layout } from '../tokens';

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

  it('mirrors the design-system radius scale (tokens/layout.css)', () => {
    expect(radii).toEqual({
      input: 12, button: 20, card: 20, row: 22, tabBar: 24, band: 26,
      hero: 28, glass: 30, heroLg: 32, sheet: 36, pill: 999,
    });
  });

  it('mirrors the design-system layout constants', () => {
    expect(layout).toEqual({ screenMargin: 24, contentMax: 560, control: 48, cardGap: 12 });
  });
});
