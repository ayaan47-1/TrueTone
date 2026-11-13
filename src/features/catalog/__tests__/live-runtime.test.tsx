import { act, cleanup, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

jest.unmock('../../match/product-catalog');
const mockRange = jest.fn();
const mockSelect = jest.fn(() => ({ order: () => ({ range: mockRange }) }));
const mockFrom = jest.fn((_table: string) => ({ select: mockSelect }));
jest.mock('../../../lib/supabase', () => ({ DEMO_MODE:false, SUPABASE_OFFLINE:false, supabase:{from:(table: string) => mockFrom(table)} }));
import { useProductCatalogue, refreshCatalogue } from '../../match/product-catalog';

function Probe() { const state=useProductCatalogue(); return <Text>{`${state.status}:${state.products.length}`}</Text>; }
afterEach(async()=>{await cleanup();});

test('normal runtime queries only the safe view and renders an honest empty state', async () => {
  mockRange.mockResolvedValue({data:[],error:null});
  const view=await render(<Probe />);
  await waitFor(() => expect(view.getByText('empty:0')).toBeTruthy());
  expect(mockFrom).toHaveBeenCalledWith('catalog_recommendable');
  expect(mockSelect).toHaveBeenCalledWith(expect.not.stringContaining('*'));
});

test('read failure renders offline with no synthetic products', async () => {
  mockRange.mockResolvedValue({data:null,error:{message:'internal'}});
  const view=await render(<Probe />);
  await act(async () => { await refreshCatalogue(true); });
  await waitFor(() => expect(view.getByText('offline:0')).toBeTruthy());
  expect(view.queryByText(/Lumira|Solene/)).toBeNull();
});
