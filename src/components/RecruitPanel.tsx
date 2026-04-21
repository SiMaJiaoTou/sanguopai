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
  return labels.join(',');
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
    <div className="rounded-2xl bg-black/40 border border-white/10 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-gold font-bold">🏯 主公府 · 招募</div>
        <div className="text-[10px] text-white/40">Lv {recruitLevel} / 6</div>
      </div>

      {/* 经验条 */}
      <div>
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-[11px] text-white/55">招募等级经验</span>
          <span className="text-[11px] text-gold tabular-nums">
            {isMax ? 'MAX' : `${recruitExp} / ${expNeed}`}
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-black/50 overflow-hidden border border-white/10">
          <motion.div
            className="h-full bg-gradient-to-r from-yellow-300 via-gold to-amber-600"
            initial={{ width: 0 }}
            animate={{ width: `${expPercent}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
        <div className="text-[9px] text-white/40 mt-1">
          已解锁点数: <span className="text-amber-200">{unlockedLabelShort(recruitLevel)}</span>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onBuy}
          disabled={!canBuy}
          className={[
            'flex flex-col items-center justify-center py-2.5 rounded-xl border touch-manipulation',
            canBuy
              ? 'bg-gradient-to-b from-amber-700 to-amber-900 border-gold/60 text-white hover:brightness-110 active:scale-95'
              : 'bg-white/5 border-white/10 text-white/35 cursor-not-allowed',
          ].join(' ')}
          title={`招募：随机抽 1 张已解锁武将 · 消耗 ${buyPrice} 金币`}
        >
          <div className="text-sm font-bold flex items-center gap-1">
            <span>⚔</span>
            <span>招募武将</span>
          </div>
          <div className="text-[10px] opacity-80 mt-0.5">需 🪙 {buyPrice}</div>
        </button>

        <button
          onClick={onUpgrade}
          disabled={!canUpgrade}
          className={[
            'flex flex-col items-center justify-center py-2.5 rounded-xl border touch-manipulation',
            canUpgrade
              ? 'bg-gradient-to-b from-red-800 to-red-950 border-red-400/60 text-white hover:brightness-110 active:scale-95'
              : 'bg-white/5 border-white/10 text-white/35 cursor-not-allowed',
          ].join(' ')}
          title={
            isMax
              ? '已达满级'
              : `直升 Lv.${recruitLevel + 1}：消耗 ${upgradeCost} 金币（补齐 ${expRemaining} 点经验）`
          }
        >
          <div className="text-sm font-bold flex items-center gap-1">
            <span>⬆</span>
            <span>{isMax ? '已满级' : '升级主公府'}</span>
          </div>
          <div className="text-[10px] opacity-80 mt-0.5">
            {isMax ? 'MAX' : `需 🪙 ${upgradeCost}`}
          </div>
        </button>
      </div>

      <div className="text-[10px] text-white/35 leading-relaxed border-t border-white/5 pt-2">
        💡 招募价格：第 N 次需 N 金币 · 升级 1 金币=1 经验 · 每年结束会自动获得少量经验
      </div>
    </div>
  );
}
