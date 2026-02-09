import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { memo, useMemo } from 'react';
import { getFaviconUrl } from '../../../shared/utils/faviconUtils';

interface ModelPieChartProps {
  data: any[];
  title?: string;
  className?: string;
}

const COLORS = [
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#22c55e', // Green
  '#eab308', // Yellow
  '#f97316', // Orange
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#a855f7', // Purple
];

export const ModelPieChart = memo(({ data, title, className }: ModelPieChartProps) => {
  // Transform data for Pie Chart: Top 9 + Others
  const chartData = useMemo(() => {
    const sorted = [...data].sort((a, b) => b.value - a.value);
    if (sorted.length <= 10) return sorted;

    const top9 = sorted.slice(0, 9);
    const others = sorted.slice(9);
    const othersValue = others.reduce((sum, item) => sum + item.value, 0);

    return [
      ...top9,
      {
        name: 'Other',
        value: othersValue,
        website: null, // No icon for "Other"
      },
    ];
  }, [data]);

  const renderCustomizedLabel = (props: any) => {
    const { cx, cy, midAngle, outerRadius, percent, name, website } = props;
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 25;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    const iconUrl = website ? getFaviconUrl(website, 32) : null;
    const iconSize = 14;
    const isRight = x > cx;

    return (
      <foreignObject
        x={isRight ? x : x - 150}
        y={y - 10}
        width={150}
        height={20}
        style={{ overflow: 'visible' }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isRight ? 'flex-start' : 'flex-end',
            gap: '6px',
            width: '100%',
            height: '100%',
            color: 'currentColor',
            fontSize: '11px',
            fontWeight: 500,
          }}
        >
          {iconUrl && (
            <img
              src={iconUrl}
              alt=""
              style={{
                width: `${iconSize}px`,
                height: `${iconSize}px`,
                borderRadius: '2px',
                flexShrink: 0,
              }}
            />
          )}
          <span
            style={{
              whiteSpace: 'nowrap',
              color: 'var(--text-secondary)',
            }}
          >
            {`${name} (${(percent * 100).toFixed(0)}%)`}
          </span>
        </div>
      </foreignObject>
    );
  };

  return (
    <div
      className={`col-span-3 rounded-xl bg-card text-card-foreground shadow-sm p-6 outline-none focus:outline-none usage-chart-container ${className || ''}`}
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
      <div className="mb-6 flex flex-col space-y-1.5">
        <h3 className="font-semibold leading-none tracking-tight">
          {title || 'Model Distribution'}
        </h3>
        <p className="text-sm text-muted-foreground">Request distribution overview.</p>
      </div>
      <div className="h-[300px] w-full" tabIndex={-1}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart accessibilityLayer={false} tabIndex={-1}>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
              labelLine={{ stroke: 'currentColor', strokeWidth: 1, opacity: 0.3 }}
              label={renderCustomizedLabel}
              stroke="none"
            >
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--dropdown-background)',
                borderColor: 'var(--divider)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontSize: '12px',
                border: '1px solid var(--divider)',
                boxShadow: 'var(--dropdown-shadow)',
              }}
              itemStyle={{ color: 'var(--text-primary)' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});
