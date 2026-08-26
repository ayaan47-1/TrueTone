import { Text, type TextProps } from 'react-native';

// Typography scale for the brief system. Each component locks a font-family
// (Plus Jakarta Sans display / Inter body) and a default colour so screens stay
// consistent; pass `className` to extend or override per use.

type Props = TextProps & { className?: string };

function cx(base: string, extra?: string): string {
  return extra ? `${base} ${extra}` : base;
}

/** Hero / screen title. */
export function Display({ className, ...rest }: Props) {
  return (
    <Text
      className={cx('font-display text-[30px] font-bold leading-[36px] tracking-[-0.7px] text-ink', className)}
      {...rest}
    />
  );
}

/** Shade name — the foundation shade hero label (B2 ShadeResult). */
export function ShadeName({ className, ...rest }: Props) {
  return (
    <Text
      className={cx('font-display text-[27px] font-bold leading-[32px] tracking-[-0.4px] text-ink', className)}
      {...rest}
    />
  );
}

/** Section / card heading. */
export function Heading({ className, ...rest }: Props) {
  return (
    <Text
      className={cx('font-display text-2xl font-bold leading-[30px] tracking-[-0.3px] text-ink', className)}
      {...rest}
    />
  );
}

/** Smaller heading for dense surfaces. */
export function Subheading({ className, ...rest }: Props) {
  return <Text className={cx('font-display text-lg font-semibold leading-snug text-ink', className)} {...rest} />;
}

/** All-caps eyebrow label. */
export function Eyebrow({ className, ...rest }: Props) {
  return (
    <Text
      className={cx('font-body text-[11px] font-semibold uppercase tracking-[1.6px] text-brand-green', className)}
      {...rest}
    />
  );
}

/** Default body copy. */
export function Body({ className, ...rest }: Props) {
  return <Text className={cx('font-body text-[15px] leading-[22px] text-ink-soft', className)} {...rest} />;
}

/** Quiet secondary copy. */
export function Caption({ className, ...rest }: Props) {
  return <Text className={cx('font-body text-xs leading-[18px] text-ink-muted', className)} {...rest} />;
}
