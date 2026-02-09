/**
 * Default color palette with a variety of colors
 */
export const DEFAULT_COLORS = [
  // Reds
  '#ef4444',
  '#dc2626',
  '#b91c1c',
  '#991b1b',
  // Oranges
  '#f97316',
  '#ea580c',
  '#c2410c',
  '#9a3412',
  // Yellows
  '#eab308',
  '#ca8a04',
  '#a16207',
  '#854d0e',
  // Greens
  '#22c55e',
  '#16a34a',
  '#15803d',
  '#166534',
  // Teals
  '#14b8a6',
  '#0d9488',
  '#0f766e',
  '#115e59',
  // Blues
  '#3b82f6',
  '#2563eb',
  '#1d4ed8',
  '#1e40af',
  // Indigos
  '#6366f1',
  '#4f46e5',
  '#4338ca',
  '#3730a3',
  // Purples
  '#a855f7',
  '#9333ea',
  '#7e22ce',
  '#6b21a8',
  // Pinks
  '#ec4899',
  '#db2777',
  '#be185d',
  '#9f1239',
  // Grays
  '#6b7280',
  '#4b5563',
  '#374151',
  '#1f2937',
  // Additional colors
  '#06b6d4',
  '#0891b2',
  '#0e7490',
  '#155e75',
  '#84cc16',
  '#65a30d',
  '#4d7c0f',
  '#3f6212',
];

/**
 * Get grid template columns style
 */
export const getGridStyle = (columns: number) => ({
  display: 'grid',
  gridTemplateColumns: `repeat(${columns}, 1fr)`,
});

/**
 * Get color box style
 */
export const getColorBoxStyle = (
  color: string,
  size: number,
  isSelected: boolean,
  disabled: boolean,
) => ({
  width: `${size}px`,
  height: `${size}px`,
  backgroundColor: color,
  borderRadius: '6px',
  cursor: disabled ? 'not-allowed' : 'pointer',
  border: isSelected ? '3px solid var(--primary)' : '2px solid transparent',
  opacity: disabled ? 0.5 : 1,
  transition: 'all 0.2s ease',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative' as const,
  boxShadow: isSelected
    ? '0 0 0 2px var(--background), 0 0 0 4px var(--primary)'
    : '0 1px 3px rgba(0, 0, 0, 0.1)',
});

/**
 * Check if color is light or dark to determine checkmark color
 */
export const isLightColor = (color: string): boolean => {
  // Convert hex to RGB
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5;
};
