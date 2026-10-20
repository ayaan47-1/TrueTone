import { View } from 'react-native';
import { Body, Display, PrimaryButton } from '../../../../components/ui';
import { SHOP_OFFLINE_MESSAGE } from '../client';

interface Props {
  readonly actionLabel?: string;
  readonly onAction?: () => void;
}

/** Camera build (Dwight FAIL on PR #60): local-only stand-in for every Shopify screen. */
export function ShopOfflineNotice({ actionLabel, onAction }: Props) {
  return (
    <View className="flex-1 items-center justify-center px-7">
      <Display className="text-center">{SHOP_OFFLINE_MESSAGE}</Display>
      <Body className="mt-3 text-center">
        This build runs on your device only. Nothing is loaded from or sent to Shopify.
      </Body>
      {actionLabel && onAction ? <PrimaryButton className="mt-6" label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}
