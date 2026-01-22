import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface TokenUsageChartProps {
  data: any[];
  byProvider?: Record<string, number>; // Total by provider to determine colors/lines if we want multi-lines
  type?: 'total' | 'provider';
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F'];

export const TokenUsageChart = ({ data, type = 'total' }: TokenUsageChartProps) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground border border-dashed rounded-lg">
        No usage data available for this period.
      </div>
    );
  }

  // If type is 'provider', we need keys for each provider
  const providerKeys =
    type === 'provider'
      ? Array.from(new Set(data.flatMap((d) => Object.keys(d.byProvider || {}))))
      : ['total'];

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{
            top: 10,
            right: 30,
            left: 0,
            bottom: 0,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
          <XAxis dataKey="label" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis
            stroke="#888888"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              borderColor: 'hsl(var(--border))',
              borderRadius: '8px',
            }}
            itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
            labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
          />
          <Legend />

          {type === 'total' ? (
            <Area
              type="monotone"
              dataKey="total"
              stroke="#8884d8"
              fill="#8884d8"
              fillOpacity={0.2}
              name="Total Tokens"
            />
          ) : (
            providerKeys.map((key, index) => (
              <Area
                key={key}
                type="monotone"
                dataKey={`byProvider.${key}`}
                stroke={COLORS[index % COLORS.length]}
                fill={COLORS[index % COLORS.length]}
                fillOpacity={0.1}
                name={key}
                stackId="1" // Stacked area for provider usage? Or separate lines? Area is usually stacked.
              />
            ))
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
