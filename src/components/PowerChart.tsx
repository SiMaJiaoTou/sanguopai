import { motion } from 'framer-motion';
import type { PowerSnapshot } from '../store';

interface Props {
  history: PowerSnapshot[];
  currentRound: number;
  currentTotalPower: number;
  isFinished: boolean;
}

/**
 * 自绘 SVG 折线图 —— 自适应峰值 + 三国竹简风
 *  - y 轴峰值 = 当前所有数据点中最大值，向上取整到"美观刻度"
 *  - 仅在数据全为 0 时最小显示 50 (防止空图)
 */
export function PowerChart({ history, currentRound, currentTotalPower, isFinished }: Props) {
  const W = 420;
  const H = 210;
  const PAD_L = 40;
  const PAD_R = 12;
  const PAD_T = 18;
  const PAD_B = 30;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const totalRounds = 6;

  const historyPoints = history.map((s) => ({ round: s.round, power: s.totalPower }));
  const lastHistRound = history.length > 0 ? history[history.length - 1].round : -1;

  const previewPoints =
    !isFinished && currentRound !== lastHistRound
      ? [{ round: currentRound, power: currentTotalPower }]
      : [];

  const allPoints = [...historyPoints, ...previewPoints];

  // 峰值自适应：取数据最大值，向上对齐到美观步长
  const dataMax = Math.max(0, ...allPoints.map((p) => p.power));

  const niceCeil = (v: number): number => {
    if (v <= 0) return 50;
    // 选择合适步长：1位/2位/3位/4位 数
    const magnitude = Math.pow(10, Math.floor(Math.log10(v)));
    const rel = v / magnitude;
    let step: number;
    if (rel <= 1.5) step = 0.25 * magnitude;
    else if (rel <= 3) step = 0.5 * magnitude;
    else if (rel <= 6) step = 1 * magnitude;
    else step = 2 * magnitude;
    return Math.ceil(v / step) * step;
  };
  const niceMax = dataMax > 0 ? niceCeil(dataMax * 1.05) : 50;

  const x = (r: number) => PAD_L + (r / totalRounds) * innerW;
  const y = (v: number) => PAD_T + innerH - (v / niceMax) * innerH;

  const linePath = historyPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.round)} ${y(p.power)}`)
    .join(' ');

  let previewPath = '';
  if (previewPoints.length && historyPoints.length) {
    const last = historyPoints[historyPoints.length - 1];
    const pv = previewPoints[0];
    previewPath = `M ${x(last.round)} ${y(last.power)} L ${x(pv.round)} ${y(pv.power)}`;
  }

  const areaPath =
    historyPoints.length > 1
      ? `${linePath} L ${x(historyPoints[historyPoints.length - 1].round)} ${y(0)} L ${x(historyPoints[0].round)} ${y(0)} Z`
      : '';

  // 4 条刻度线
  const yTicks = [0, niceMax * 0.25, niceMax * 0.5, niceMax * 0.75, niceMax].map((v) =>
    Math.round(v),
  );

  const fmt = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 1 : 2)}k`.replace('.00k', 'k') : `${n}`;

  return (
    <div className="relative rounded-2xl bg-gradient-to-b from-[#3b2816] to-[#1a1109] border-2 border-amber-900/60 p-4 shadow-lg scroll-paper overflow-hidden">
      {/* 左右竹节装饰 */}
      <div className="absolute left-0 top-0 h-full w-2 bg-gradient-to-b from-amber-700 via-amber-900 to-amber-700 opacity-40" />
      <div className="absolute right-0 top-0 h-full w-2 bg-gradient-to-b from-amber-700 via-amber-900 to-amber-700 opacity-40" />

      <div className="flex items-center justify-between mb-2 relative">
        <div className="flex items-center gap-2">
          <span className="text-red-500 text-lg">㊉</span>
          <div className="text-gold-grad font-bold tracking-widest">战 · 录</div>
        </div>
        <div className="text-[10px] text-amber-200/60">
          峰值 <span className="text-gold tabular-nums">{fmt(niceMax)}</span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#78350f" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
          <pattern id="scrollHatch" patternUnits="userSpaceOnUse" width="8" height="8">
            <path d="M 0 8 L 8 0" stroke="rgba(251,191,36,0.05)" strokeWidth="1" />
          </pattern>
          <filter id="inkShadow">
            <feGaussianBlur stdDeviation="1.2" />
          </filter>
        </defs>

        {/* 背景网格底纹 */}
        <rect
          x={PAD_L}
          y={PAD_T}
          width={innerW}
          height={innerH}
          fill="url(#scrollHatch)"
        />

        {/* 水平刻度 */}
        {yTicks.map((t) => (
          <g key={t}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={y(t)}
              y2={y(t)}
              stroke="rgba(251,191,36,0.12)"
              strokeDasharray="2 4"
            />
            <text
              x={PAD_L - 6}
              y={y(t) + 3.5}
              textAnchor="end"
              fontSize="10"
              fill="rgba(253,230,138,0.6)"
              fontFamily="serif"
            >
              {fmt(t)}
            </text>
          </g>
        ))}

        {/* X 轴刻度（年份） */}
        {Array.from({ length: totalRounds + 1 }, (_, i) => i).map((r) => (
          <g key={r}>
            <line
              x1={x(r)}
              x2={x(r)}
              y1={PAD_T + innerH}
              y2={PAD_T + innerH + 4}
              stroke="rgba(253,230,138,0.35)"
            />
            <text
              x={x(r)}
              y={PAD_T + innerH + 18}
              textAnchor="middle"
              fontSize="10"
              fill="rgba(253,230,138,0.75)"
              fontFamily="serif"
              fontWeight="bold"
            >
              {r === 0 ? '初' : `${['一', '二', '三', '四', '五', '六'][r - 1]}`}
            </text>
          </g>
        ))}

        {/* 面积 */}
        {areaPath && <path d={areaPath} fill="url(#areaGrad)" />}

        {/* 折线阴影（墨色） */}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="rgba(0,0,0,0.5)"
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#inkShadow)"
          />
        )}

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
            stroke="#fbbf24"
            strokeOpacity="0.7"
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
              r={4.5}
              fill="#fde68a"
              stroke="#b45309"
              strokeWidth={1.8}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1 * i + 0.4, type: 'spring', stiffness: 300 }}
            />
            <text
              x={x(p.round)}
              y={y(p.power) - 9}
              textAnchor="middle"
              fontSize="10"
              fontWeight="bold"
              fill="#fde68a"
              fontFamily="serif"
              stroke="rgba(0,0,0,0.6)"
              strokeWidth={0.5}
              paintOrder="stroke"
            >
              {fmt(p.power)}
            </text>
          </g>
        ))}

        {/* 预览点（当前未结算） */}
        {previewPoints.map((p, i) => (
          <g key={`p-${i}`}>
            <circle
              cx={x(p.round)}
              cy={y(p.power)}
              r={5.5}
              fill="none"
              stroke="#fbbf24"
              strokeWidth={1.5}
              strokeDasharray="2 2"
            >
              <animate attributeName="r" values="4;8;4" dur="1.6s" repeatCount="indefinite" />
            </circle>
            <circle cx={x(p.round)} cy={y(p.power)} r={3} fill="#fbbf24" />
            <text
              x={x(p.round)}
              y={y(p.power) - 11}
              textAnchor="middle"
              fontSize="10"
              fontWeight="bold"
              fill="#fbbf24"
              fontFamily="serif"
              stroke="rgba(0,0,0,0.6)"
              strokeWidth={0.5}
              paintOrder="stroke"
            >
              {fmt(p.power)}
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
            fill="rgba(253,230,138,0.45)"
            fontFamily="serif"
          >
            · 尚无战绩录入 ·
          </text>
        )}
      </svg>

      <div className="flex items-center gap-4 text-[11px] text-amber-100/60 mt-1 relative">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-[2px] bg-gradient-to-r from-amber-200 to-amber-600" />
          已结算
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0 border-t-2 border-dashed border-amber-400" />
          当期预览
        </span>
        <span className="ml-auto">凡 {history.length} 卷</span>
      </div>
    </div>
  );
}
