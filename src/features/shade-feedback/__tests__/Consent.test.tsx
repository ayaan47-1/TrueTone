import { fireEvent, render } from '@testing-library/react-native';
jest.mock('../flags',()=>({SERVER_FEEDBACK_ENABLED:true}));
import { ShadeFeedbackConsent } from '../ShadeFeedbackConsent';

test('separate improvement choice starts unchecked, requires affirmation and leaves decline effect-free',async()=>{
  const accept=jest.fn().mockResolvedValue(undefined),decline=jest.fn();
  const view=await render(<ShadeFeedbackConsent onAccept={accept} onDecline={decline} />);
  expect(view.getByRole('checkbox').props.accessibilityState.checked).toBe(false);
  await fireEvent.press(view.getByText('Allow optional feedback'));
  expect(accept).not.toHaveBeenCalled();
  await fireEvent.press(view.getByText('Not now'));
  expect(decline).toHaveBeenCalledTimes(1);
  expect(accept).not.toHaveBeenCalled();
  await fireEvent.press(view.getByRole('checkbox'));
  await fireEvent.press(view.getByText('Allow optional feedback'));
  expect(accept).toHaveBeenCalledTimes(1);
});
