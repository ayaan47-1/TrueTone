import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ShadeFeedbackScreen } from '../ShadeFeedbackScreen';
import { ShadeFeedbackConsent } from '../ShadeFeedbackConsent';

test('server consent notice is not presented while collection is disabled',async()=>{
  const view=await render(<ShadeFeedbackConsent onAccept={jest.fn()} onDecline={jest.fn()} />);
  expect(view.queryByRole('checkbox')).toBeNull();
});

test('explicit local save records directions, while cancel records nothing',async()=>{
  const save=jest.fn().mockResolvedValue(undefined);
  const onClose=jest.fn();
  const view=await render(<ShadeFeedbackScreen variantId="gid://shopify/ProductVariant/1" save={save} onClose={onClose} />);
  await fireEvent.press(view.getByText('Cancel'));
  expect(save).not.toHaveBeenCalled();
  await fireEvent.press(view.getByText('Too light'));
  await fireEvent.press(view.getByText('Undertone as expected'));
  await fireEvent.press(view.getByText('Save on this phone'));
  await waitFor(()=>expect(save).toHaveBeenCalledWith({variant_gid:'gid://shopify/ProductVariant/1',depth_correction:'too_light',undertone_correction:'as_expected',outcome:null}));
  expect(view.queryByText(/upload/i)).toBeNull();
});
