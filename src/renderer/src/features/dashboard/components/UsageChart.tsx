import { memo } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from '../../../shared/components/ui/dropdown';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { getFaviconUrl } from '../../../shared/utils/faviconUtils';

interface UsageChartProps {
  data: any[];
  title?: string;
  period: 'day' | 'week' | 'month' | 'year';
  offset: number;
  onPeriodChange: (period: 'day' | 'week' | 'month' | 'year') => void;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const requests = payload.find((p: any) => p.dataKey === 'requests')?.value;
    const tokens = payload.find((p: any) => p.dataKey === 'tokens')?.value;

    return (
      <div className="bg-[var(--dropdown-background)] border border-[var(--divider)] rounded-lg p-3 shadow-xl backdrop-blur-md min-w-[200px]">
        <p className="text-xs font-bold text-[var(--text-primary)] mb-2 border-b border-[var(--divider)] pb-1">
          {label}
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-blue-400 font-medium">Requests:</span>
            <span className="text-[var(--text-primary)] font-bold">
              {requests.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-violet-400 font-medium">Tokens:</span>
            <span className="text-[var(--text-primary)] font-bold">
              {tokens > 1000 ? (tokens / 1000).toFixed(1) + 'k' : tokens}
            </span>
          </div>
        </div>

        {data.providers && data.providers.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-[var(--divider)]">
            <p className="text-[10px] uppercase text-[var(--text-secondary)] font-bold tracking-wider mb-1">
              Provider Breakdown
            </p>
            {data.providers.map((p: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <img src={getFaviconUrl(p.website, 16)} className="w-3 h-3 rounded-sm" alt="" />
                  <span className="text-[11px] text-[var(--text-primary)] capitalize">
                    {p.name}
                  </span>
                </div>
                <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                  {p.requests} reqs
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  return null;
};

export const UsageChart = memo(
  ({ data, title, period, offset, onPeriodChange, onPrev, onNext, className }: UsageChartProps) => {
    const renderPeriodTitle = () => {
      const now = new Date();
      const months = [
        'Tháng 1',
        'Tháng 2',
        'Tháng 3',
        'Tháng 4',
        'Tháng 5',
        'Tháng 6',
        'Tháng 7',
        'Tháng 8',
        'Tháng 9',
        'Tháng 10',
        'Tháng 11',
        'Tháng 12',
      ];

      switch (period) {
        case 'day': {
          const targetDate = new Date(now.getTime() - offset * 24 * 60 * 60 * 1000);
          return (
            <span className="text-sm font-medium">
              Ngày <span className="text-primary">{targetDate.getDate()}</span>{' '}
              {months[targetDate.getMonth()]}, {targetDate.getFullYear()}
            </span>
          );
        }
        // ... (rest of renderPeriodTitle remains same)
        case 'week': {
          const end = new Date(now.getTime() - offset * 7 * 24 * 60 * 60 * 1000);
          const start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
          return (
            <span className="text-sm font-medium">
              <span className="text-primary">
                {start.getDate()}/{start.getMonth() + 1}
              </span>{' '}
              -{' '}
              <span className="text-primary">
                {end.getDate()}/{end.getMonth() + 1}
              </span>
              , {end.getFullYear()}
            </span>
          );
        }
        case 'month': {
          const targetDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
          return (
            <span className="text-sm font-medium">
              <span className="text-primary">{months[targetDate.getMonth()]}</span>,{' '}
              {targetDate.getFullYear()}
            </span>
          );
        }
        case 'year': {
          const targetYear = now.getFullYear() - offset;
          return (
            <span className="text-sm font-medium">
              Năm <span className="text-primary">{targetYear}</span>
            </span>
          );
        }
        default:
          return null;
      }
    };

    return (
      <div
        className={`col-span-4 rounded-xl bg-card text-card-foreground shadow-sm p-6 outline-none focus:outline-none usage-chart-container ${className || ''}`}
        onMouseDown={(e) => e.preventDefault()}
      >
        <style>{`
          .usage-chart-container *:focus,
          .usage-chart-container *:focus-visible,
          .usage-chart-container *:active {
            outline: none !important;
            box-shadow: none !important;
          }
          .recharts-wrapper, .recharts-surface, .recharts-responsive-container, svg {
            outline: none !important;
            border: none !important;
          }
        `}</style>
        <div className="mb-6 flex items-center justify-between">
          <div className="flex flex-col space-y-1">
            <h3 className="font-semibold leading-none tracking-tight">
              {title || 'Usage Analytics'}
            </h3>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium opacity-70">
              {period === 'day' ? 'Volume & Token Consumption' : `Activity Overview - ${period}`}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center bg-[var(--input-background)] rounded-lg p-1 border border-[var(--divider)]">
              <button
                onClick={onPrev}
                className="p-1 hover:bg-[var(--dropdown-item-hover)] rounded-md transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="px-3 min-w-[140px] text-center border-x border-[var(--divider)] mx-1">
                {renderPeriodTitle()}
              </div>
              <button
                onClick={onNext}
                disabled={offset === 0}
                className={`p-1 rounded-md transition-colors ${offset === 0 ? 'opacity-20 cursor-not-allowed' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--dropdown-item-hover)]'}`}
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <Dropdown position="bottom-right" size="sm">
              <DropdownTrigger className="bg-[var(--dropdown-background)] hover:bg-[var(--dropdown-item-hover)] text-[var(--text-primary)] text-xs font-medium rounded-lg px-3 py-1.5 border border-[var(--divider)] shadow-sm flex items-center gap-2 min-w-[80px] justify-between">
                <span>
                  {period === 'day'
                    ? 'Ngày'
                    : period === 'week'
                      ? 'Tuần'
                      : period === 'month'
                        ? 'Tháng'
                        : 'Năm'}
                </span>
                <ChevronDown size={14} className="opacity-50" />
              </DropdownTrigger>
              <DropdownContent minWidth="100px" className="p-1">
                {['day', 'week', 'month', 'year'].map((p) => (
                  <DropdownItem
                    key={p}
                    onClick={() => onPeriodChange(p as any)}
                    className={period === p ? 'bg-[var(--dropdown-item-hover)]' : ''}
                  >
                    {p === 'day' ? 'Ngày' : p === 'week' ? 'Tuần' : p === 'month' ? 'Tháng' : 'Năm'}
                  </DropdownItem>
                ))}
              </DropdownContent>
            </Dropdown>
          </div>
        </div>

        <div className="h-[300px] w-full" tabIndex={-1}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              accessibilityLayer={false}
              tabIndex={-1}
            >
              <defs>
                <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--divider)"
                opacity={0.3}
              />
              <XAxis
                dataKey="date"
                stroke="var(--text-secondary)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                dy={10}
              />
              <YAxis
                yAxisId="left"
                stroke="var(--text-secondary)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                dx={-10}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="var(--text-secondary)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                dx={10}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: 'var(--divider)', strokeWidth: 1 }}
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="requests"
                stroke="var(--primary)"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorRequests)"
                activeDot={{ r: 5, strokeWidth: 0, fill: 'var(--primary)' }}
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="tokens"
                stroke="#8b5cf6"
                strokeWidth={2}
                strokeDasharray="5 5"
                fillOpacity={1}
                fill="url(#colorTokens)"
                activeDot={{ r: 4, strokeWidth: 0, fill: '#8b5cf6' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  },
);
