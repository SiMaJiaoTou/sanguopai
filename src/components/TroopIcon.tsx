import type { TroopType } from '../types';

interface Props {
  troop: TroopType;
  size?: number;
  color?: string;
  className?: string;
}

export function TroopIcon({ troop, size = 16, color = 'currentColor', className = '' }: Props) {
  switch (troop) {
    case '骑':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          <path d="M7 10l-.85 8.507A1.357 1.357 0 0 0 7.5 20h.146a2 2 0 0 0 1.857-1.257l.994-2.486a2 2 0 0 1 1.857-1.257h1.292a2 2 0 0 1 1.857 1.257l.994 2.486A2 2 0 0 0 18.354 20h.146a1.37 1.37 0 0 0 1.364-1.494L19 9h-8c0-3-3-5-6-5L2 10l2 2 3-2" />
          <path d="M22 14v-2a3 3 0 0 0-3-3" />
        </svg>
      );
    case '弓':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          <path d="M8 4c6 4 6 12 0 16" />
          <path d="M8 4v16" />
          <path d="M3 12h18" />
          <path d="M17 8l4 4-4 4" />
          <path d="M7 10l-2 2 2 2" />
        </svg>
      );
    case '盾':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          <path d="M12 3l7 3v5c0 5.25-3 8.5-7 10.5C8 19.5 5 16.25 5 11V6l7-3z" />
          <path d="M12 3v18.5" />
        </svg>
      );
    default:
      return null;
  }
}
