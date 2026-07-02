import { render, screen } from '@testing-library/react-native';
import { RoutineView } from '../RoutineView';
import type { Routine } from '../routine-types';

const routine: Routine = {
  version: 'skincare-1',
  am: [{ category: 'a broad-spectrum SPF 30+ sunscreen', habit: 'apply every morning', rationale: 'daily habit', dimensions: [] }],
  pm: [{ category: 'a gentle exfoliant (low-strength)', habit: 'twice a week', rationale: 'for texture', dimensions: [] }],
  notes: ['Your skin reads on the drier side.'],
};

test('renders AM and PM steps and the disclaimer', async () => {
  await render(<RoutineView routine={routine} />);
  expect(screen.getByText(/broad-spectrum SPF/)).toBeTruthy();
  expect(screen.getByText(/gentle exfoliant/)).toBeTruthy();
  expect(screen.getByText(/looks.*not medical advice/i)).toBeTruthy();
});

test('marks emphasized steps with a Focus today label', async () => {
  const routine = {
    version: 'skincare-1',
    am: [
      { category: 'gentle hydrating cleanser', habit: 'h', rationale: 'r', dimensions: [], emphasized: true },
      { category: 'a broad-spectrum SPF 30+ sunscreen', habit: 'h', rationale: 'r', dimensions: [] },
    ],
    pm: [],
    notes: [],
  };
  await render(<RoutineView routine={routine} />);
  expect(screen.getAllByText(/focus today/i)).toHaveLength(1);
});

test('renders no Focus label when nothing is emphasized', async () => {
  const routine = {
    version: 'skincare-1',
    am: [{ category: 'gentle hydrating cleanser', habit: 'h', rationale: 'r', dimensions: [] }],
    pm: [],
    notes: [],
  };
  await render(<RoutineView routine={routine} />);
  expect(screen.queryByText(/focus today/i)).toBeNull();
});
