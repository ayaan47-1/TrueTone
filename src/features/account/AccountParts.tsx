// src/features/account/AccountParts.tsx
// Presentational pieces of the v3 Account tab (video frames t-15/t-17): the header with the
// logo mark + notifications bell, the profile card with stats, and the grouped row sections.
// Local View-drawn glyphs (the app's icon convention, no icon library, no image assets). The
// bell reuses the shipped Liquid Glass control (GlassSurface), exactly like the Bag button.
import type { ReactNode } from 'react';
import { Image, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Caption, Display, GlassCard, GlassSurface, ListRow, PressableScale, Eyebrow } from '../../components/ui';
import { glass, palette, shadeGradient } from '../../theme/tokens';
import type { AccountSummary } from './account-summary';

/** Four overlapping tone dots, light to deep — the v3 logo mark, drawn in Views. */
export function LogoMark() {
  const tones = ['#F1CDB2', '#C98A62', '#8A4F33', '#3E2418'];
  return (
    <View className="flex-row items-center" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {tones.map((c, i) => (
        <View key={c} style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: c, marginLeft: i ? -5 : 0 }} />
      ))}
    </View>
  );
}

export function BellGlyph({ color, size = 19 }: { color: string; size?: number }) {
  const w = size * 0.62;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: w,
          height: size * 0.56,
          borderTopLeftRadius: w / 2,
          borderTopRightRadius: w / 2,
          borderWidth: 2,
          borderBottomWidth: 0,
          borderColor: color,
        }}
      />
      <View style={{ width: size * 0.84, height: 2, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ width: size * 0.22, height: size * 0.12, marginTop: 1, borderBottomLeftRadius: size, borderBottomRightRadius: size, backgroundColor: color }} />
    </View>
  );
}

export function AccountHeader({ onBell }: { onBell: () => void }) {
  return (
    <View className="mt-1 flex-row items-center justify-between gap-3">
      <View className="flex-row items-center gap-2.5">
        <LogoMark />
        <Display>Account</Display>
      </View>
      <PressableScale accessibilityRole="button" accessibilityLabel="Notifications" onPress={onBell} className="h-11 w-11 rounded-full">
        <GlassSurface
          interactive
          intensity={0}
          style={{ flex: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}
          fallbackStyle={{ backgroundColor: glass.fillStrong, borderWidth: 1, borderColor: glass.edge }}
        >
          <BellGlyph color={palette.ink} />
        </GlassSurface>
      </PressableScale>
    </View>
  );
}

interface ProfileCardProps {
  summary: AccountSummary;
  scanned: boolean;
  avatarUri: string | null;
  avatarDisabled: boolean;
  onAvatar: () => void;
  onEdit: () => void;
  editing: boolean;
}

function Avatar({ initial, scanned, uri }: { initial: string; scanned: boolean; uri: string | null }) {
  if (uri) return <Image testID="avatar-image" source={{ uri }} style={{ width: 62, height: 62, borderRadius: 31 }} />;
  const colors = scanned ? shadeGradient : ([palette.mist300, palette.mist300] as const);
  return (
    <LinearGradient colors={colors} style={{ width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center' }}>
      <Text className="font-display text-[22px] font-bold text-ink-soft">{initial}</Text>
    </LinearGradient>
  );
}

export function ProfileCard({ summary, scanned, avatarUri, avatarDisabled, onAvatar, onEdit, editing }: ProfileCardProps) {
  return (
    <GlassCard flat radius={26} className="px-[18px] py-[18px]">
      <View className="flex-row items-center gap-3.5">
        <PressableScale testID="avatar-picker" accessibilityRole="button" accessibilityLabel="Change avatar" accessibilityState={{ disabled: avatarDisabled }} disabled={avatarDisabled} onPress={onAvatar}>
          <Avatar initial={summary.initial} scanned={scanned} uri={avatarUri} />
        </PressableScale>
        <View className="flex-1">
          <Text className="font-display text-[18px] font-bold text-ink" numberOfLines={1}>{summary.displayName}</Text>
          {summary.profileLine ? <Caption numberOfLines={1}>{summary.profileLine}</Caption> : null}
          <View
            className="mt-1.5 flex-row items-center self-start gap-1.5 rounded-full py-1 pl-[5px] pr-2.5"
            style={{ backgroundColor: scanned ? palette.tint : palette.mist300 }}
          >
            <LinearGradient colors={scanned ? shadeGradient : ([palette.inkFaint, palette.inkFaint] as const)} style={{ width: 14, height: 14, borderRadius: 7 }} />
            <Text className="font-body text-[11.5px] font-semibold" style={{ color: scanned ? palette.sageInk : palette.inkSoft }}>
              {summary.shadeLabel}
            </Text>
          </View>
        </View>
        <PressableScale accessibilityRole="button" accessibilityLabel="Edit profile" accessibilityState={{ expanded: editing }} onPress={onEdit} className="min-h-[44px] justify-center px-1">
          <Text className="font-body text-[13px] font-semibold" style={{ color: palette.sage }}>Edit</Text>
        </PressableScale>
      </View>
      <View className="mt-4 flex-row border-t pt-3.5" style={{ borderTopColor: 'rgba(168,159,143,0.2)' }}>
        {summary.stats.map((s, i) => (
          <View key={s.label} accessible accessibilityLabel={`${s.value} ${s.label}`} className="flex-1 items-center" style={i ? { borderLeftWidth: 1, borderLeftColor: 'rgba(168,159,143,0.2)' } : undefined}>
            <Text className="font-display text-[20px] font-bold text-ink">{s.value}</Text>
            <Caption>{s.label}</Caption>
          </View>
        ))}
      </View>
    </GlassCard>
  );
}

export interface AccountRow {
  label: string;
  caption?: string;
  icon?: ReactNode;
  onPress: () => void;
  destructive?: boolean;
}

export function AccountGroup({ title, rows }: { title: string; rows: readonly AccountRow[] }) {
  return (
    <View className="mt-6">
      <Eyebrow className="mb-2.5 ml-1">{title}</Eyebrow>
      <GlassCard flat radius={22} className="px-5 py-1">
        {rows.map((r, i) => (
          <View key={r.label} style={i ? { borderTopWidth: 1, borderTopColor: 'rgba(168,159,143,0.2)' } : undefined}>
            <ListRow label={r.label} caption={r.caption} icon={r.icon} onPress={r.onPress} destructive={r.destructive} hideChevron={r.destructive} />
          </View>
        ))}
      </GlassCard>
    </View>
  );
}
