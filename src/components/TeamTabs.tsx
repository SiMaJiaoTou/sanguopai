import { motion } from 'framer-motion';

interface Props {
  activeTeamIndex: 0 | 1;
  onSwitch: (idx: 0 | 1) => void;
  team0Power: number;
  team1Power: number;
  team0Full: boolean;
  team1Full: boolean;
}

/**
 * 军团切换页签（双队列时显示）
 * 样式：木质肩章式按钮，朱砂/金漆高亮当前页签
 */
export function TeamTabs({
  activeTeamIndex,
  onSwitch,
  team0Power,
  team1Power,
  team0Full,
  team1Full,
}: Props) {
  const tabs: {
    index: 0 | 1;
    label: string;
    power: number;
    full: boolean;
  }[] = [
    { index: 0, label: '前 军', power: team0Power, full: team0Full },
    { index: 1, label: '后 军', power: team1Power, full: team1Full },
  ];

  return (
    <div className="relative flex items-stretch gap-2">
      {tabs.map((t) => {
        const active = t.index === activeTeamIndex;
        return (
          <motion.button
            key={t.index}
            onClick={() => onSwitch(t.index)}
            whileTap={{ scale: 0.97 }}
            className={[
              'relative flex-1 px-4 py-2.5 rounded-t-lg font-kai tracking-widest',
              'border-2 border-b-0 transition-all touch-manipulation',
              active
                ? 'bg-gradient-to-b from-[#c89c3e] via-[#8b6914] to-[#4a3810] border-gold text-[#2a1808]'
                : 'bg-gradient-to-b from-[#5a3a24] to-[#2a1810] border-amber-900 text-amber-100/70 hover:brightness-110',
            ].join(' ')}
            style={{
              boxShadow: active
                ? 'inset 0 2px 2px rgba(255,245,200,0.5), inset 0 -3px 6px rgba(80,50,10,0.7), 0 -2px 6px rgba(212,175,55,0.4)'
                : 'inset 0 2px 2px rgba(255,200,120,0.25), inset 0 -2px 4px rgba(0,0,0,0.5)',
              marginBottom: -2,
            }}
          >
            {/* 左侧朱砂印章 */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div
                  className="seal-red w-7 h-7 text-[10px] flex-shrink-0"
                  style={{ transform: 'rotate(-6deg) scale(0.95)' }}
                >
                  {t.index === 0 ? '前' : '后'}
                </div>
                <div className="flex flex-col items-start leading-tight">
                  <span className="text-sm sm:text-base font-black">
                    {t.label}
                  </span>
                  <span
                    className={[
                      'text-[10px] tracking-wider',
                      active ? 'text-red-900' : t.full ? 'text-emerald-300' : 'text-amber-200/60',
                    ].join(' ')}
                  >
                    {t.full ? '已成阵' : '配阵中'}
                  </span>
                </div>
              </div>

              {/* 战力数字 */}
              <div
                className={[
                  'text-lg sm:text-xl font-black tabular-nums font-kai flex-shrink-0',
                  active ? 'text-[#2a1808]' : 'text-amber-100',
                ].join(' ')}
              >
                {t.power}
              </div>
            </div>

            {/* 激活态下方金线 */}
            {active && (
              <motion.div
                layoutId="team-tab-indicator"
                className="absolute bottom-[-2px] left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-gold to-transparent"
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
