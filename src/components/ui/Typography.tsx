import { Text, type TextProps } from 'react-native';

// Typography scale for the "Mist" system. Each component locks a font-family
// (Fraunces display / Mulish body) and a default colour so screens stay
// consistent; pass `className` to extend or override per use.
//
// Refinement (presentation-only — no copy changes): the display tier moves from
// Fraunces 600 SemiBold to Fraunces 500 Medium with tighter optical tracking.
// At hero sizes the lighter cut reads more editorial and premium; tightened
// letter-spacing keeps it from feeling loose. Body tiers are unchanged.

type Props = TextProps & { className?: string };

function cx(base: string, extra?: string): string {
  return extra ? `${base} ${extra}` : base;
}

/** Hero / screen title — soft optical serif, lighter + tighter. */
export function Display({ className, ...rest }: Props) {
  return (
    <Text
      className={cx('text-[28px] font-bold leading-[34px] tracking-[-0.5px] text-ink', className)}
      {...rest}
    />
  );
}

/** Section / card heading. */
export function Heading({ className, ...rest }: Props) {
  return (
    <Text
      className={cx('text-2xl font-bold leading-[30px] tracking-[-0.3px] text-ink', className)}
      {...rest}
    />
  );
}

/** Smaller heading for dense surfaces. */
export function Subheading({ className, ...rest }: Props) {
  return <Text className={cx('text-lg font-semibold leading-snug text-ink', className)} {...rest} />;
}

/** All-caps eyebrow label. */
export function Eyebrow({ className, ...rest }: Props) {
  return (
    <Text
      className={cx('text-[11px] font-semibold uppercase tracking-[1.6px] text-sage', className)}
      {...rest}
    />
  );
}

/** Default body copy. */
export function Body({ className, ...rest }: Props) {
  return <Text className={cx('text-[15px] leading-[22px] text-ink-soft', className)} {...rest} />;
}

/** Quiet secondary copy. */
export function Caption({ className, ...rest }: Props) {
  return <Text className={cx('text-xs leading-[18px] text-ink-muted', className)} {...rest} />;
}
