import { glass, palette, radii, layout } from '../tokens';

describe('Quiet Glass design contract', () => {
  it('uses the approved warm neutral palette', () => {
    expect(palette.background).toBe('#faf7f2');
    expect(palette.ink).toBe('#221F1A');
    expect(palette.inkSoft).toBe('#6B655B');
    expect(palette.inkMuted).toBe('#8A8378');
    expect(palette.sage).toBe('#9a4e34');
    expect(palette.sageInk).toBe('#9a4e34');
    expect(palette.green).toBe('#9a4e34');
    expect(palette.greenDark).toBe('#9a4e34');
    expect(palette.tint).toBe('#F8EEE7');
    expect(palette.mist200).toBe('#F8EEE7');
    expect(palette.clay).toBe('#c26a4a');
    expect(palette.terracotta).toBe('#c26a4a');
    expect(palette.terracottaDark).toBe('#9a4e34');
  });

  it('keeps white button labels readable on the dark terracotta action color', () => {
    const luminance = (hex: string) => {
      const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
      const linear = channels.map((channel) => channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4);
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    };
    const contrastWithWhite = 1.05 / (luminance(palette.terracottaDark) + 0.05);
    expect(contrastWithWhite).toBeGreaterThanOrEqual(4.5);
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
