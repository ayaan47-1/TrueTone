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
        const fg = d.isToday ? palette.white : d.isFuture ? palette.inkFaint : palette.inkMuted;
        return (
          <View
            key={d.key}
            testID={`week-day-${d.key}`}
            accessibilityLabel={`${d.label}${d.isToday ? ', today' : ''}`}
            style={styles.col}
          >
            <Caption style={{ fontSize: 12, color: d.isToday ? palette.ink : d.isFuture ? palette.inkFaint : palette.inkMuted }}>
              {d.label.slice(0, 1)}
            </Caption>
            <View style={[styles.cell, d.isToday && styles.cellToday]}>
              {d.hasScan ? (
                <View style={[styles.check, { borderColor: fg }]} />
              ) : (
                <View style={[styles.dot, { backgroundColor: d.isToday ? palette.white : palette.mist400 }]} />
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
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  cellToday: {
    backgroundColor: palette.sage,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
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
