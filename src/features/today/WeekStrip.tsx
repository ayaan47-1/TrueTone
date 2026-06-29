import { View, StyleSheet } from 'react-native';
import { Caption } from '../../components/ui';
import { palette } from '../../theme/tokens';
import { buildWeek } from './week';

interface WeekStripProps {
  scanDateKeys: readonly string[];
  today?: Date;
}

/**
 * The Sun→Sat week strip on Today: each day shows a check if it holds a scan,
 * otherwise its date number. Today is highlighted; future days are dimmed.
 */
export function WeekStrip({ scanDateKeys, today = new Date() }: WeekStripProps) {
  const days = buildWeek(today, scanDateKeys);
  return (
    <View className="flex-row justify-between">
      {days.map((d) => {
        const fg = d.isToday ? palette.mauve600 : d.isFuture ? palette.inkFaint : palette.inkSoft;
        return (
          <View key={d.key} style={styles.col}>
            <Caption style={{ fontSize: 10, color: d.isFuture ? palette.inkFaint : palette.inkMuted }}>
              {d.label}
            </Caption>
            <View style={[styles.cell, d.isToday && styles.cellToday]}>
              {d.hasScan ? (
                <View style={[styles.check, { borderColor: fg }]} />
              ) : (
                <Caption style={[styles.num, { color: fg }]}>{d.dayOfMonth}</Caption>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  col: { flex: 1, alignItems: 'center', gap: 6 },
  cell: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  cellToday: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderColor: palette.mauve400,
  },
  num: { fontFamily: 'Mulish_600SemiBold', fontSize: 14 },
  // A small check drawn as a rotated corner.
  check: {
    width: 12,
    height: 7,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    transform: [{ rotate: '-45deg' }],
    marginTop: -2,
  },
});
