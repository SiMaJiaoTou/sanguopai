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
    <div className="relative rounded-lg wood-panel bronze-border rivets wood-dark space-y-3">
      <div className="rivet-b" />

      <div className="flex items-center justify-between relative ink-underline">
        <div className="flex items-center gap-2">
          <span className="text-red-500 text-base">㊉</span>
          <div className="text-gold-grad font-black tracking-[0.25em] font-kai">主 公 府</div>
        </div>
        <div className="seal-red w-8 h-8 text-[10px] font-black">
          Lv{recruitLevel}
        </div>
      </div>

      {/* 经验条 */}
      <div>
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-[11px] text-amber-100/70 tracking-widest font-kai">威 望</span>
          <span className="text-[11px] text-gold-grad tabular-nums font-black">
            {isMax ? '━━ 滿級 ━━' : `${recruitExp} / ${expNeed}`}
          </span>
        </div>
        <div
          className="h-3 w-full rounded-full overflow-hidden border-2 border-amber-900"
          style={{
            background: '#1a0f08',
            boxShadow: 'inset 0 2px 3px rgba(0,0,0,0.9)',
          }}
        >
          <motion.div
            className="h-full"
            initial={{ width: 0 }}
            animate={{ width: `${expPercent}%` }}
            transition={{ duration: 0.5 }}
            style={{
              background: 'linear-gradient(180deg, #fde68a 0%, #d4af37 40%, #8b6914 100%)',
              boxShadow: '0 0 6px rgba(251,191,36,0.7), inset 0 1px 0 rgba(255,245,200,0.5)',
            }}
          />
        </div>
        <div className="text-[10px] text-amber-100/60 mt-1.5">
          已解鎖：
          <span className="text-gold-grad font-kai font-black tracking-wider ml-1">
            {unlockedLabelShort(recruitLevel)}
          </span>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onBuy}
          disabled={!canBuy}
          className="btn-wood btn-gold py-3 px-2"
          title={`招募：随机抽 1 张已解锁武将 · 消耗 ${buyPrice} 金币`}
        >
          <div className="flex flex-col items-center gap-0.5">
            <div className="text-sm font-black flex items-center gap-1 tracking-[0.3em]">
              <span>⚔</span>
              <span>招募</span>
            </div>
            <div className="text-[11px] tabular-nums font-black">
              🪙 {buyPrice}
            </div>
          </div>
        </button>

        <button
          onClick={onUpgrade}
          disabled={!canUpgrade}
          className="btn-wood btn-red py-3 px-2"
          title={
            isMax
              ? '已达满级'
              : `直升 Lv.${recruitLevel + 1}：消耗 ${upgradeCost} 金币`
          }
        >
          <div className="flex flex-col items-center gap-0.5">
            <div className="text-sm font-black flex items-center gap-1 tracking-[0.3em]">
              <span>⬆</span>
              <span>{isMax ? '滿級' : '擢升'}</span>
            </div>
            <div className="text-[11px] tabular-nums font-black">
              {isMax ? 'MAX' : `🪙 ${upgradeCost}`}
            </div>
          </div>
        </button>
      </div>

      <div className="text-[10px] text-amber-100/50 leading-relaxed border-t border-amber-900 pt-2 italic">
        ◈ 招募第 N 次需 N 金币 · 擢升 1 金币 ＝ 1 威望 · 每年自动得少量威望
      </div>
    </div>
  );
}
