import { View } from 'react-native';
import { Body, Caption, PrimaryButton } from '../../components/ui';
import { refreshCatalogue } from '../match/product-catalog';
import type { CatalogueSnapshot } from './state';

export function CatalogueNotice({ state }: { state: CatalogueSnapshot }) {
  if (state.status === 'ready' || state.status === 'demo') return null;
  return <View className="my-3 gap-2">
    <Body>{state.status === 'loading' || state.status === 'idle' ? 'Loading verified shades…' : state.status === 'empty' ? 'No verified shades available' : 'Catalogue unavailable'}</Body>
    {state.status === 'empty' ? <Caption>New shades appear after review and stock updates.</Caption> : null}
    {state.status === 'offline' ? <Caption>Reconnect to check current shades, prices and availability.</Caption> : null}
    {state.status === 'offline' || state.status === 'empty' ? <PrimaryButton label="Try again" variant="glass" onPress={() => void refreshCatalogue(true)} /> : null}
  </View>;
}
