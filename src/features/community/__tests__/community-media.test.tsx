import { render } from '@testing-library/react-native';
import { MediaPlaceholder } from '../components/MediaPlaceholder';
import { CreatorHeader } from '../components/CreatorHeader';

const photo = 7; // what require('./x.jpg') resolves to under Metro

test('a media item with a bundled image renders the photo with its caption chip', async () => {
  const view = await render(
    <MediaPlaceholder media={[{ id: 'm1', kind: 'photo', label: 'Dewy base', swatch: '#E9C39A', image: photo }]} />,
  );
  expect(view.getByTestId('media-image-m1').props.source).toBe(photo);
  expect(view.getByText('Dewy base')).toBeTruthy();
  expect(view.queryByTestId(/^media-dot-/)).toBeNull();
});

test('more than one media item shows carousel dots', async () => {
  const view = await render(
    <MediaPlaceholder
      media={[
        { id: 'a', kind: 'photo', label: 'One', swatch: '#EEE' },
        { id: 'b', kind: 'photo', label: 'Two', swatch: '#DDD' },
      ]}
    />,
  );
  expect(view.getAllByTestId(/^media-dot-/)).toHaveLength(2);
});

test('the creator avatar uses an explicit colour when given', async () => {
  const view = await render(
    <CreatorHeader creator={{ userId: 'u', username: 'maya_glows', avatarUri: null }} color="#123456" />,
  );
  expect(view.getByTestId('creator-avatar-placeholder')).toHaveStyle({ backgroundColor: "#123456" });
});
