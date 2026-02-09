import { memo } from 'react';

interface MiniTableProps {
  title: string;
  data: any[];
  className?: string;
  columns: {
    header: string;
    accessorKey: string;
    className?: string;
    cell?: (item: any) => React.ReactNode;
  }[];
}

export const MiniTable = memo(({ title, data, columns, className }: MiniTableProps) => {
  return (
    <div
      className={`rounded-xl border border-border/50 bg-card text-card-foreground shadow-sm ${className || ''}`}
    >
      <div className="p-6 pb-4">
        <h3 className="font-semibold leading-none tracking-tight">{title}</h3>
      </div>
      <div className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-left text-muted-foreground hover:bg-muted/50">
                {columns.map((col, i) => (
                  <th key={i} className={`px-6 py-3 font-medium ${col.className || ''}`}>
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 5).map((item, i) => (
                <tr
                  key={i}
                  className="border-b border-border/50 transition-colors hover:bg-muted/50"
                >
                  {columns.map((col, j) => (
                    <td key={j} className={`px-6 py-3 ${col.className || ''}`}>
                      {col.cell ? col.cell(item) : item[col.accessorKey]}
                    </td>
                  ))}
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-6 py-4 text-center text-muted-foreground"
                  >
                    No data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});
