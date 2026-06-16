import { computeIs18Plus } from '../age';
test('exactly 18 today passes', () => {
  const d = new Date(); d.setFullYear(d.getFullYear() - 18);
  expect(computeIs18Plus(d, new Date())).toBe(true);
});
test('one day under 18 fails', () => {
  const now = new Date('2026-06-15');
  const dob = new Date('2008-06-16');
  expect(computeIs18Plus(dob, now)).toBe(false);
});
