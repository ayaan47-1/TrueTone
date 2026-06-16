import { render } from '@testing-library/react-native';
import { PolicyList } from '../PolicyList';
test('lists all five policy docs', async () => {
  const { getByText } = await render(<PolicyList onOpen={jest.fn()} />);
  ['Privacy Policy','Terms of Use','Biometric Data Policy','Data Retention Schedule','WA Consumer Health Data Policy']
    .forEach((t) => expect(getByText(t)).toBeTruthy());
});
