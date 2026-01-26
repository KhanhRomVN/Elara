import { LucideIcon } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';

interface SummaryCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  color?: string; // e.g., "text-violet-500", "border-violet-500"
}

export const SummaryCard = ({
  title,
  value,
  icon: Icon,
  description,
  trend,
  className,
  color = 'text-primary',
}: SummaryCardProps) => {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border bg-card/50 text-card-foreground shadow-sm transition-all hover:shadow-md hover:bg-card/80 group',
        className,
      )}
    >
      {/* Top Border Accent */}
      <div
        className={cn(
          'absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-50',
          color.replace('text-', 'bg-'),
        )}
      />

      <div className="p-6">
        <div className="flex items-center justify-between space-y-0 pb-2">
          <h3 className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
            {title}
          </h3>
          <div
            className={cn(
              'p-2 rounded-full bg-background/50 ring-1 ring-inset ring-border/50 transition-colors group-hover:ring-current/20',
              color,
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="flex flex-col gap-1 mt-2">
          <div className="text-2xl font-bold tracking-tight">{value}</div>
          {(description || (trend && typeof trend.value === 'number')) && (
            <div className="flex items-center text-xs text-muted-foreground">
              {trend && (
                <span
                  className={cn(
                    'mr-2 font-medium',
                    trend.isPositive ? 'text-green-500' : 'text-red-500',
                  )}
                >
                  {trend.isPositive ? '↑' : '↓'} {trend.value}%
                </span>
              )}
              {description}
            </div>
          )}
        </div>
      </div>

      {/* Corner Glow Effect (Subtle) */}
      <div
        className={cn(
          'absolute -bottom-6 -right-6 h-24 w-24 rounded-full opacity-0 blur-3xl transition-opacity group-hover:opacity-10 pointer-events-none',
          color.replace('text-', 'bg-'),
        )}
      />
    </div>
  );
};
