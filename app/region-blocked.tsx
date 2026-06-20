import { View } from 'react-native';
import { MistBackground, GlassCard, Display, Body, Eyebrow } from '../src/components/ui';

export default function RegionBlocked() {
  return (
    <MistBackground>
      <View className="flex-1 items-center justify-center px-8">
        <GlassCard className="px-7 py-9 items-center gap-3" radius={32}>
          <Eyebrow>Not yet here</Eyebrow>
          <Display className="text-center text-3xl">Unavailable</Display>
          <Body className="text-center">TrueTone is not available in your region.</Body>
        </GlassCard>
      </View>
    </MistBackground>
  );
}
