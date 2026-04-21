import type { CSSProperties, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  title?: ReactNode;
  titleRight?: ReactNode;
  variant?: 'dark' | 'light';
  className?: string;
  style?: CSSProperties;
  /** 是否显示四角铆钉 */
  rivets?: boolean;
  /** 额外装饰：底部汉字题款 */
  footer?: ReactNode;
}

/**
 * 配将台风格木质面板
 * 组成：深色木板底 + 青铜框 + 四角铆钉 + 金漆标题 + 朱砂㊉
 */
export function WoodPanel({
  children,
  title,
  titleRight,
  variant = 'dark',
  className = '',
  style,
  rivets = true,
  footer,
}: Props) {
  const bgClass = variant === 'dark' ? 'wood-dark' : 'wood-light';

  return (
    <div
      className={[
        'relative rounded-lg wood-panel bronze-border',
        bgClass,
        rivets ? 'rivets' : '',
        className,
      ].join(' ')}
      style={style}
    >
      {rivets && <div className="rivet-b" />}

      {title && (
        <div className="flex items-center justify-between mb-3 ink-underline">
          <div className="flex items-center gap-2">
            <span className="text-red-500 text-base leading-none">㊉</span>
            <div className="text-gold-grad font-black tracking-[0.25em] font-kai text-base">
              {title}
            </div>
          </div>
          {titleRight}
        </div>
      )}

      <div className="relative">{children}</div>

      {footer && (
        <div className="mt-3 pt-2 border-t border-amber-900/60 text-[10px] text-amber-100/50 italic">
          {footer}
        </div>
      )}
    </div>
  );
}
