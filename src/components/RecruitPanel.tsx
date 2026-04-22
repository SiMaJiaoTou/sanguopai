import { motion } from 'framer-motion';
import { LEVEL_EXP_REQUIRED, LEVEL_UNLOCK_TABLE } from '../data';
import { buyCardPrice } from '../store';

interface Props {
  gold: number;
  buyCount: number;
  recruitLevel: number;
  recruitExp: number;
  onBuy: () => void;
  onUpgrade: () => void;
  disabled?: boolean;
}

function unlockedLabelShort(level: number): string {
  const values = LEVEL_UNLOCK_TABLE[level] ?? [];
  if (values.length === 0) return '-';
  const labels = values.map((v) => {
    if (v === 15) return '2';
    if (v === 14) return 'A';
    if (v === 13) return 'K';
    if (v === 12) return 'Q';
    if (v === 11) return 'J';
    return String(v);
  });
  return labels.join(' ');
}

export function RecruitPanel({
  gold,
  buyCount,
  recruitLevel,
  recruitExp,
  onBuy,
  onUpgrade,
  disabled,
}: Props) {
  const buyPrice = buyCardPrice(buyCount);
  const canBuy = !disabled && gold >= buyPrice;

  const isMax = recruitLevel >= 6;
  const expNeed = isMax ? 0 : LEVEL_EXP_REQUIRED[recruitLevel];
  const upgradeCost = isMax ? 0 : 1;
  const canUpgrade = !disabled && !isMax && gold >= upgradeCost;

  const expPercent = isMax ? 100 : Math.min(100, (recruitExp / expNeed) * 100);

  return (
    <div className="relative rounded-lg wood-panel bronze-border rivets wood-dark space-y-4">
      <div className="rivet-b" />

      {/* 卷首 */}
      <div className="flex items-center justify-between relative">
        <div className="flex items-center gap-3">
          <span className="scroll-tag text-[11px]">主公府</span>
          <span className="text-[10px] text-amber-200/55 italic tracking-widest hidden sm:inline">
            招贤纳士
          </span>
        </div>
        <div
          className="jade-seal text-[11px]"
          title={`主公府等级 Lv.${recruitLevel}${isMax ? ' · 已达满级' : ''}`}
        >
          Lv{recruitLevel}
        </div>
      </div>
      <div className="ornament-meander" />

      {/* 威望条 */}
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-[11px] text-amber-100/75 tracking-[0.3em] font-kai font-black">
            威 望
          </span>
          <span className="text-[11px] text-gold-grad tabular-nums font-black">
            {isMax ? '── 满 级 ──' : `${recruitExp} / ${expNeed}`}
          </span>
        </div>
        <div
          className="relative h-3.5 w-full rounded-full overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, #0a0604 0%, #1f120a 100%)',
            border: '1.5px solid #3a2414',
            boxShadow:
              'inset 0 2px 4px rgba(0,0,0,0.95), inset 0 -1px 0 rgba(80,50,10,0.45), 0 1px 0 rgba(255,200,120,0.15)',
          }}
        >
          {/* 刻度分段 */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                'repeating-linear-gradient(90deg, transparent 0 calc(20% - 1px), rgba(139,90,40,0.45) calc(20% - 1px) 20%)',
            }}
          />
          <motion.div
            className="h-full relative"
            initial={{ width: 0 }}
            animate={{ width: `${expPercent}%` }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            style={{
              background:
                'linear-gradient(180deg, #fff2cc 0%, #f7d57a 25%, #d4af37 55%, #8b5a28 100%)',
              boxShadow:
                '0 0 10px rgba(212,175,55,0.75), inset 0 1px 0 rgba(255,245,200,0.7), inset 0 -1px 2px rgba(100,60,10,0.5)',
            }}
          >
            {/* 流动光 */}
            <div className="sweep-sheen" />
          </motion.div>
        </div>
        <div className="text-[10px] text-amber-100/65 mt-2 tracking-wider">
          已解锁 ·
          <span className="text-gold-grad font-kai font-black tracking-[0.22em] ml-1">
            {unlockedLabelShort(recruitLevel)}
          </span>
        </div>
      </div>

      {/* 两枚令牌（招募 · 擢升） */}
      <div className="grid grid-cols-2 gap-3">
        <motion.button
          whileHover={canBuy ? { y: -2 } : undefined}
          whileTap={canBuy ? { y: 4 } : undefined}
          onClick={onBuy}
          disabled={!canBuy}
          className="btn-seal btn-seal-gold relative overflow-hidden"
          title={`招募 · 随机抽 1 张已解锁武将 · 消耗 ${buyPrice} 金币`}
        >
          <div className="text-[13px] tracking-[0.35em] leading-none">招 募</div>
          <div className="text-[10px] tabular-nums opacity-80 tracking-wider">
            🪙 {buyPrice} 金
          </div>
          {canBuy && <div className="sweep-sheen" />}
        </motion.button>

        <motion.button
          whileHover={canUpgrade ? { y: -2 } : undefined}
          whileTap={canUpgrade ? { y: 4 } : undefined}
          onClick={onUpgrade}
          disabled={!canUpgrade}
          className="btn-seal relative overflow-hidden"
          title={
            isMax
              ? '已达满级'
              : `消耗 1 金币获得 1 威望（满 ${expNeed} 自动升级至 Lv.${recruitLevel + 1}）`
          }
        >
          <div className="text-[13px] tracking-[0.35em] leading-none">
            {isMax ? '满 级' : '擢 升'}
          </div>
          <div className="text-[10px] tabular-nums opacity-85 tracking-wider">
            {isMax ? 'MAX' : '🪙 1 → +1 望'}
          </div>
        </motion.button>
      </div>

      <div className="ornament-meander" />
      <div className="text-[10px] text-amber-100/55 leading-relaxed italic text-center font-kai">
        招募第 N 次需 N 金 · 擢升 1 金 ＝ 1 威望 · 每岁自获威望
      </div>
    </div>
  );
}
