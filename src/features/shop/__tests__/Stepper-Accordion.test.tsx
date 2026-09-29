import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Stepper } from '../Stepper';
import { Accordion } from '../Accordion';

describe('Stepper', () => {
  test('increments and decrements through onChange, not below min', async () => {
    const onChange = jest.fn();
    const view = await render(<Stepper value={1} min={1} onChange={onChange} label="Quantity" />);
    await fireEvent.press(view.getByRole('button', { name: 'Increase quantity' }));
    expect(onChange).toHaveBeenLastCalledWith(2);
    await fireEvent.press(view.getByRole('button', { name: 'Decrease quantity' }));
    expect(onChange).toHaveBeenLastCalledWith(1);
    expect(view.getByText('1')).toBeTruthy();
  });

  test('can go to 0 when min is 0 (bag removal)', async () => {
    const onChange = jest.fn();
    const view = await render(<Stepper value={1} min={0} onChange={onChange} label="Quantity" />);
    await fireEvent.press(view.getByRole('button', { name: 'Decrease quantity' }));
    expect(onChange).toHaveBeenLastCalledWith(0);
  });
});

describe('Accordion', () => {
  test('toggles its body and reports expanded state', async () => {
    const view = await render(<Accordion title="Details"><Text>Body copy</Text></Accordion>);
    const header = view.getByRole('button', { name: 'Details' });
    expect(view.queryByText('Body copy')).toBeNull();
    await fireEvent.press(header);
    expect(view.getByText('Body copy')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Details' })).toHaveAccessibilityState({ expanded: true });
  });

  test('can start open', async () => {
    const view = await render(<Accordion title="Why it fits you" initiallyOpen><Text>Reason</Text></Accordion>);
    expect(view.getByText('Reason')).toBeTruthy();
  });
});
