import { View, Text, StyleSheet, useWindowDimensions, Dimensions, PixelRatio } from 'react-native';
import { useInsets } from './use-insets';

/**
 * DEV-ONLY diagnostic overlay: prints the live window/screen dimensions, safe-area
 * insets, font scale and pixel ratio. Used to calibrate responsive layout on real
 * devices (e.g. the Galaxy Fold's folded vs unfolded states). Never shipped — mount
 * it behind `__DEV__`.
 */
export function DevDimensions() {
  const win = useWindowDimensions();
  const screen = Dimensions.get('screen');
  const insets = useInsets();
  const r = (n: number) => Math.round(n);
  return (
    <View pointerEvents="none" style={styles.box}>
      <Text style={styles.txt}>win {r(win.width)}×{r(win.height)}  scr {r(screen.width)}×{r(screen.height)}</Text>
      <Text style={styles.txt}>
        ins T{r(insets.top)} B{r(insets.bottom)} L{r(insets.left)} R{r(insets.right)}
      </Text>
      <Text style={styles.txt}>
        fontScale {win.fontScale.toFixed(2)}  px {PixelRatio.get().toFixed(2)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    top: 4,
    left: 4,
    zIndex: 9999,
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  txt: { color: '#9DF9C6', fontSize: 11, fontFamily: 'Mulish_600SemiBold' },
});
