import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface ModelPieChartProps {
  data: any[];
  title?: string;
}

const COLORS = ['#8b5cf6', '#ec4899', '#06b6d4', '#22c55e', '#eab308', '#f97316'];

export const ModelPieChart = ({ data, title }: ModelPieChartProps) => {
  // Transform data for Pie Chart
  const chartData = data.sort((a, b) => b.value - a.value).slice(0, 6); // Top 6

  return (
    <div className="col-span-3 rounded-xl border border-border/50 bg-card text-card-foreground shadow-sm p-6">
      <div className="mb-6 flex flex-col space-y-1.5">
        <h3 className="font-semibold leading-none tracking-tight">
          {title || 'Model Distribution'}
        </h3>
        <p className="text-sm text-muted-foreground">Token usage by model.</p>
      </div>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#18181b',
                borderColor: '#27272a',
                borderRadius: '8px',
                color: '#fff',
              }}
              itemStyle={{ color: '#fff' }}
            />
            <Legend verticalAlign="bottom" height={36} iconType="circle" />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
