import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';

interface UsageLineChartProps {
  data: any[];
  title?: string;
}

export const UsageLineChart = ({ data, title }: UsageLineChartProps) => {
  return (
    <div className="col-span-4 rounded-xl border border-border/50 bg-card text-card-foreground shadow-sm p-6">
      <div className="mb-6 flex flex-col space-y-1.5">
        <h3 className="font-semibold leading-none tracking-tight">{title || 'Usage Trends'}</h3>
        <p className="text-sm text-muted-foreground">Daily request volume over the last 30 days.</p>
      </div>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff10" />
            <XAxis
              dataKey="date"
              stroke="#888888"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              dy={10}
            />
            <YAxis
              stroke="#888888"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}`}
              dx={-10}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(24, 24, 27, 0.9)',
                borderColor: '#27272a',
                borderRadius: '8px',
                color: '#fff',
                backdropFilter: 'blur(4px)',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
              itemStyle={{ color: '#fff' }}
              cursor={{ stroke: '#8b5cf6', strokeWidth: 2, strokeDasharray: '4 4' }}
            />
            <Area
              type="monotone"
              dataKey="requests"
              stroke="#8b5cf6"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorRequests)"
              activeDot={{ r: 6, strokeWidth: 0, fill: '#fff' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
