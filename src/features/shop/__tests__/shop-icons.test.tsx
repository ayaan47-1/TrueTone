import { render } from '@testing-library/react-native';
import { SearchGlyph, PlusGlyph, CheckGlyph, ChevronGlyph, TrashGlyph } from '../shop-icons';

test.each([
  ['search', <SearchGlyph key="s" color="#000" />],
  ['plus', <PlusGlyph key="p" color="#000" />],
  ['minus', <PlusGlyph key="m" color="#000" minus />],
  ['check', <CheckGlyph key="c" color="#000" />],
  ['chevron', <ChevronGlyph key="v" color="#000" dir="down" />],
  ['trash', <TrashGlyph key="t" color="#000" />],
])('%s glyph renders from plain views', async (name, el) => {
  const view = await render(el);
  expect(view.getByTestId(`glyph-${name}`)).toBeTruthy();
});
