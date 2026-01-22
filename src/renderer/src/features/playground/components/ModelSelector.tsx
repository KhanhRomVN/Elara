import { CustomSelect } from './CustomSelect';

interface Model {
  id: string;
  name: string;
  [key: string]: any;
}

interface ModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
  models: Model[];
  placeholder?: string;
  disabled?: boolean;
}

export const ModelSelector = ({
  value,
  onChange,
  models,
  placeholder = 'Select Model',
  disabled,
}: ModelSelectorProps) => {
  // Helper to format model label (removing common prefixes if any)
  const getModelLabel = (modelName: string) => {
    let label = modelName;
    if (label.startsWith('models/')) label = label.split('models/')[1];
    return label;
  };

  const options = models.map((m) => ({
    value: m.id || m.name,
    label: getModelLabel(m.name || m.id),
    details: m, // Pass the whole model object as details
  }));

  return (
    <div className="w-[300px]">
      <CustomSelect
        value={value}
        onChange={onChange}
        options={options}
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  );
};
