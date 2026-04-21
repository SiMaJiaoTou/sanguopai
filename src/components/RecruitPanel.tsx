import { motion } from 'framer-motion';
import { ECONOMY_CONFIG, LEVEL_EXP_REQUIRED, LEVEL_UNLOCK_TABLE } from '../data';
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
  const expRemaining = isMax ? 0 : Math.max(0, expNeed - recruitExp);
  const upgradeCost = expRemaining * ECONOMY_CONFIG.upgradeExpPerGold;
  const canUpgrade = !disabled && !isMax && gold >= upgradeCost;

  const expPercent = isMax ? 100 : Math.min(100, (recruitExp / expNeed) * 100);

  return (
    <div
      className={[
        'relative rounded-2xl p-4 space-y-3 scroll-paper',
        'bg-gradient-to-b from-[#3b2816] to-[#1a1109]',
        'border-2 border-amber-800/60 shadow-card-deep',
      ].join(' ')}
    >
      {/* 角落装饰 */}
      <div className="absolute top-1 left-1 w-4 h-4 border-l-2 border-t-2 border-gold/60 rounded-tl-lg" />
      <div className="absolute top-1 right-1 w-4 h-4 border-r-2 border-t-2 border-gold/60 rounded-tr-lg" />

      <div className="flex items-center justify-between relative">
        <div className="flex items-center gap-2">
          <span className="text-red-500 text-lg">㊉</span>
          <div className="text-gold-grad font-bold tracking-[0.25em] font-kai">主 公 府</div>
        </div>
        <div className="seal-red w-7 h-7 text-[10px] flex items-center justify-center">
          Lv {recruitLevel}
        </div>
      </div>

      {/* 经验条 */}
      <div>
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-[11px] text-amber-200/60 tracking-widest">威望</span>
          <span className="text-[11px] text-gold-grad tabular-nums font-bold">
            {isMax ? '—— 满级 ——' : `${recruitExp} / ${expNeed}`}
          </span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-black/60 overflow-hidden border border-amber-900/60">
          <motion.div
            className="h-full bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-600"
            initial={{ width: 0 }}
            animate={{ width: `${expPercent}%` }}
            transition={{ duration: 0.5 }}
            style={{ boxShadow: '0 0 6px rgba(251,191,36,0.6)' }}
          />
        </div>
        <div className="text-[10px] text-amber-100/50 mt-1.5">
          已解锁：
          <span className="text-amber-200 font-kai tracking-wider ml-1">
            {unlockedLabelShort(recruitLevel)}
          </span>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="grid grid-cols-2 gap-2">
        <motion.button
          whileTap={canBuy ? { scale: 0.94 } : undefined}
          onClick={onBuy}
          disabled={!canBuy}
          className={[
            'relative py-3 px-2 rounded-xl border-2 touch-manipulation overflow-hidden',
            canBuy
              ? 'bg-gradient-to-b from-amber-700 via-amber-800 to-amber-950 border-gold/70 text-amber-50 hover:brightness-110 shadow-card'
              : 'bg-black/40 border-white/10 text-white/30 cursor-not-allowed',
          ].join(' ')}
          title={`招募：随机抽 1 张已解锁武将 · 消耗 ${buyPrice} 金币`}
        >
          {canBuy && (
            <div className="absolute inset-0 bg-gradient-to-t from-gold/0 via-gold/10 to-gold/0 pointer-events-none" />
          )}
          <div className="relative flex flex-col items-center">
            <div className="text-sm font-bold flex items-center gap-1 font-kai tracking-widest">
              <span>⚔</span>
              <span>招募</span>
            </div>
            <div
              className={[
                'text-[11px] mt-0.5 tabular-nums font-bold',
                canBuy ? 'text-yellow-200' : '',
              ].join(' ')}
            >
              🪙 {buyPrice}
            </div>
          </div>
        </motion.button>

        <motion.button
          whileTap={canUpgrade ? { scale: 0.94 } : undefined}
          onClick={onUpgrade}
          disabled={!canUpgrade}
          className={[
            'relative py-3 px-2 rounded-xl border-2 touch-manipulation overflow-hidden',
            canUpgrade
              ? 'bg-gradient-to-b from-red-700 via-red-900 to-red-950 border-red-400/70 text-red-50 hover:brightness-110 shadow-card'
              : 'bg-black/40 border-white/10 text-white/30 cursor-not-allowed',
          ].join(' ')}
          title={
            isMax
              ? '已达满级'
              : `直升 Lv.${recruitLevel + 1}：消耗 ${upgradeCost} 金币`
          }
        >
          {canUpgrade && (
            <div className="absolute inset-0 bg-gradient-to-t from-red-500/0 via-red-300/10 to-red-500/0 pointer-events-none" />
          )}
          <div className="relative flex flex-col items-center">
            <div className="text-sm font-bold flex items-center gap-1 font-kai tracking-widest">
              <span>⬆</span>
              <span>{isMax ? '满级' : '擢升'}</span>
            </div>
            <div
              className={[
                'text-[11px] mt-0.5 tabular-nums font-bold',
                canUpgrade ? 'text-red-100' : '',
              ].join(' ')}
            >
              {isMax ? 'MAX' : `🪙 ${upgradeCost}`}
            </div>
          </div>
        </motion.button>
      </div>

      <div className="text-[10px] text-amber-100/40 leading-relaxed border-t border-amber-900/40 pt-2 italic">
        ◈ 招募第 N 次需 N 金币 · 擢升 1 金币 = 1 威望 · 每年自动得少量威望
      </div>
    </div>
  );
}
