import { motion } from 'framer-motion';
import type { PowerSnapshot } from '../store';

interface Props {
  history: PowerSnapshot[];
  currentRound: number;
  currentTotalPower: number;
  isFinished: boolean;
}

/**
 * 自绘 SVG 折线图
 *  - x 轴：回合 0 (开局) ~ 6
 *  - y 轴：总战力
 *  - 实线：历史快照
 *  - 虚线延伸：当前未结算的回合预览
 */
export function PowerChart({ history, currentRound, currentTotalPower, isFinished }: Props) {
  const W = 420;
  const H = 200;
  const PAD_L = 36;
  const PAD_R = 12;
  const PAD_T = 16;
  const PAD_B = 28;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const totalRounds = 6;

  // 组装数据点：先历史，再追加当前预览（若当前未结算）
  const historyPoints = history.map((s) => ({ round: s.round, power: s.totalPower }));
  const lastHistRound = history.length > 0 ? history[history.length - 1].round : -1;

  const previewPoints =
    !isFinished && currentRound !== lastHistRound
      ? [{ round: currentRound, power: currentTotalPower }]
      : [];

  const allPoints = [...historyPoints, ...previewPoints];
  const maxPower = Math.max(100, ...allPoints.map((p) => p.power), 400);
  const niceMax = Math.ceil(maxPower / 100) * 100;

  const x = (r: number) => PAD_L + (r / totalRounds) * innerW;
  const y = (v: number) => PAD_T + innerH - (v / niceMax) * innerH;

  // 折线路径
  const linePath = historyPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.round)} ${y(p.power)}`)
    .join(' ');

  // 虚线（从最后历史点到当前预览点）
  let previewPath = '';
  if (previewPoints.length && historyPoints.length) {
    const last = historyPoints[historyPoints.length - 1];
    const pv = previewPoints[0];
    previewPath = `M ${x(last.round)} ${y(last.power)} L ${x(pv.round)} ${y(pv.power)}`;
  }

  // 面积渐变区
  const areaPath =
    historyPoints.length > 1
      ? `${linePath} L ${x(historyPoints[historyPoints.length - 1].round)} ${y(0)} L ${x(historyPoints[0].round)} ${y(0)} Z`
      : '';

  const yTicks = [0, niceMax / 2, niceMax];

  return (
    <div className="rounded-2xl bg-black/40 border border-white/10 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-gold font-bold">📈 战力推移</div>
        <div className="text-[10px] text-white/40">峰值 {niceMax}</div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d4af37" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#d4af37" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="100%" stopColor="#d4af37" />
          </linearGradient>
        </defs>

        {/* 网格 + Y 轴刻度 */}
        {yTicks.map((t) => (
          <g key={t}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={y(t)}
              y2={y(t)}
              stroke="rgba(255,255,255,0.08)"
              strokeDasharray="2 3"
            />
            <text
              x={PAD_L - 6}
              y={y(t) + 4}
              textAnchor="end"
              fontSize="10"
              fill="rgba(255,255,255,0.45)"
            >
              {t}
            </text>
          </g>
        ))}

        {/* X 轴刻度 */}
        {Array.from({ length: totalRounds + 1 }, (_, i) => i).map((r) => (
          <g key={r}>
            <line
              x1={x(r)}
              x2={x(r)}
              y1={PAD_T + innerH}
              y2={PAD_T + innerH + 4}
              stroke="rgba(255,255,255,0.25)"
            />
            <text
              x={x(r)}
              y={PAD_T + innerH + 16}
              textAnchor="middle"
              fontSize="10"
              fill="rgba(255,255,255,0.5)"
            >
              {r === 0 ? '开局' : `R${r}`}
            </text>
          </g>
        ))}

        {/* 面积 */}
        {areaPath && <path d={areaPath} fill="url(#areaGrad)" />}

        {/* 折线 */}
        {linePath && (
          <motion.path
            d={linePath}
            fill="none"
            stroke="url(#lineGrad)"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
          />
        )}

        {/* 虚线预览段 */}
        {previewPath && (
          <path
            d={previewPath}
            fill="none"
            stroke="#d4af37"
            strokeOpacity="0.55"
            strokeWidth={2}
            strokeDasharray="4 4"
          />
        )}

        {/* 历史点 */}
        {historyPoints.map((p, i) => (
          <g key={`h-${i}`}>
            <motion.circle
              cx={x(p.round)}
              cy={y(p.power)}
              r={4}
              fill="#fde047"
              stroke="#d4af37"
              strokeWidth={1.5}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1 * i + 0.4, type: 'spring', stiffness: 300 }}
            />
            <text
              x={x(p.round)}
              y={y(p.power) - 8}
              textAnchor="middle"
              fontSize="10"
              fontWeight="bold"
              fill="#fde047"
            >
              {p.power}
            </text>
          </g>
        ))}

        {/* 预览点 */}
        {previewPoints.map((p, i) => (
          <g key={`p-${i}`}>
            <circle
              cx={x(p.round)}
              cy={y(p.power)}
              r={5}
              fill="none"
              stroke="#d4af37"
              strokeWidth={1.5}
              strokeDasharray="2 2"
            >
              <animate attributeName="r" values="4;7;4" dur="1.6s" repeatCount="indefinite" />
            </circle>
            <circle cx={x(p.round)} cy={y(p.power)} r={2.5} fill="#d4af37" />
            <text
              x={x(p.round)}
              y={y(p.power) - 10}
              textAnchor="middle"
              fontSize="10"
              fontWeight="bold"
              fill="#d4af37"
            >
              {p.power}?
            </text>
          </g>
        ))}

        {/* 空数据提示 */}
        {allPoints.length === 0 && (
          <text
            x={W / 2}
            y={H / 2}
            textAnchor="middle"
            fontSize="11"
            fill="rgba(255,255,255,0.3)"
          >
            （尚无战力记录）
          </text>
        )}
      </svg>

      {/* 图例 */}
      <div className="flex items-center gap-4 text-[11px] text-white/60 mt-1">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-[2px] bg-gold" />
          已结算
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0 border-t-2 border-dashed border-gold" />
          当前预览
        </span>
        <span className="ml-auto">共 {history.length} 条记录</span>
      </div>
    </div>
  );
}
