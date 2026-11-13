import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ShadeFeedbackScreen } from '../ShadeFeedbackScreen';
import { ShadeFeedbackConsent } from '../ShadeFeedbackConsent';
import { StyleSheet } from 'react-native';

test('server consent notice is not presented while collection is disabled',async()=>{
  const view=await render(<ShadeFeedbackConsent onAccept={jest.fn()} onDecline={jest.fn()} />);
  expect(view.queryByRole('checkbox')).toBeNull();
});

test('direction choices expose their selected state and explain the disabled save',async()=>{
  const view=await render(<ShadeFeedbackScreen variantId="gid://shopify/ProductVariant/1" save={jest.fn()} onClose={jest.fn()} />);
  expect(view.getByRole('radio',{name:'Not sure about depth'}).props.accessibilityState.selected).toBe(true);
  expect(view.getByText('Pick at least one direction for depth or undertone to save.')).toBeTruthy();
  expect(view.getByText('Save on this phone')).toBeDisabled();
  const choice=view.getByRole('radio',{name:'Too light'});
  expect(StyleSheet.flatten(choice.props.style)?.height).toBeUndefined();
  await fireEvent.press(choice);
  expect(view.getByRole('radio',{name:'Too light'}).props.accessibilityState.selected).toBe(true);
  expect(view.getByRole('radio',{name:'Not sure about depth'}).props.accessibilityState.selected).toBe(false);
  expect(view.getByText('Save on this phone')).not.toBeDisabled();
  expect(StyleSheet.flatten(view.getByTestId('shade-feedback-form').props.contentContainerStyle).paddingTop).toBeGreaterThanOrEqual(56);
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
