import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

const mockProfile={loading:false,error:false,route:'home',userId:'owner'};
let mockVariant='gid://shopify/ProductVariant/1';
let mockCanSave=false;
let mockPending=false;
const mockRetry=jest.fn(async()=>{});
const mockSave=jest.fn(async(_owner:string,_answer:unknown)=>{});
jest.mock('../../src/lib/profile-context',()=>({useProfile:()=>mockProfile}));
jest.mock('expo-router',()=>({useLocalSearchParams:()=>({variant:mockVariant}),useRouter:()=>({back:jest.fn(),replace:jest.fn()})}));
jest.mock('../../src/components/ui/use-insets',()=>({useInsets:()=>({top:20,bottom:10,left:0,right:0})}));
jest.mock('../../src/features/shade-feedback/runtime',()=>({
  feedbackCleanup:{subscribe:()=>()=>{},getSnapshot:()=>mockPending,canSave:()=>mockCanSave,retry:()=>mockRetry()},
  localFeedback:{save:(owner:string,answer:unknown)=>mockSave(owner,answer)},
}));
import Route from '../shade-feedback';

beforeEach(()=>{
  Object.assign(mockProfile,{loading:false,error:false,route:'home',userId:'owner'});
  mockVariant='gid://shopify/ProductVariant/1';mockCanSave=false;mockPending=false;
  mockRetry.mockReset().mockResolvedValue(undefined);
  mockSave.mockClear();
});

test('initial checking has no retry; blocked cleanup has one card and one retry action',async()=>{
  let finish=():void=>{};
  mockRetry.mockImplementationOnce(()=>new Promise<void>(resolve=>{finish=resolve;}));
  mockPending=true;
  const view=await render(<Route />);
  expect(view.getByText('Checking feedback access…')).toBeTruthy();
  expect(view.queryAllByRole('button')).toHaveLength(0);
  await act(async()=>{finish();});
  await waitFor(()=>expect(view.getByRole('button',{name:'Try again'})).toBeTruthy());
  expect(view.getAllByTestId('feedback-access-card')).toHaveLength(1);
  expect(view.getAllByRole('button')).toHaveLength(1);
  expect(StyleSheet.flatten(view.getByTestId('shade-feedback-state').props.contentContainerStyle).paddingTop).toBe(76);
  mockRetry.mockImplementationOnce(()=>new Promise<void>(resolve=>{finish=resolve;}));
  await fireEvent.press(view.getByRole('button',{name:'Try again'}));
  expect(view.getByText('Checking feedback access…')).toBeTruthy();
  expect(view.queryAllByRole('button')).toHaveLength(0);
  await act(async()=>{finish();});
  expect(view.getAllByRole('button')).toHaveLength(1);
});

test.each([{loading:true},{error:true},{route:'consent'}])('fallback state clears the header: %j',async(state)=>{
  Object.assign(mockProfile,state);
  const view=await render(<Route />);
  expect(StyleSheet.flatten(view.getByTestId('shade-feedback-state').props.contentContainerStyle).paddingTop).toBe(76);
});

test('invalid variant state clears the header too',async()=>{
  mockVariant='invalid';
  const view=await render(<Route />);
  expect(StyleSheet.flatten(view.getByTestId('shade-feedback-state').props.contentContainerStyle).paddingTop).toBe(76);
});

test('confirmed access shows the header-safe form and retains the owner-scoped save action',async()=>{
  mockCanSave=true;
  const view=await render(<Route />);
  await waitFor(()=>expect(view.getByTestId('shade-feedback-form')).toBeTruthy());
  expect(StyleSheet.flatten(view.getByTestId('shade-feedback-form').props.contentContainerStyle).paddingTop).toBe(76);
  await fireEvent.press(view.getByRole('radio',{name:'Too light'}));
  await fireEvent.press(view.getByText('Save on this phone'));
  expect(mockSave).toHaveBeenCalledWith('owner',expect.objectContaining({variant_gid:mockVariant,depth_correction:'too_light'}));
});
