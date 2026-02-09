import React, { useState, useRef, useEffect } from 'react';
import { TextareaProps } from './Textarea.types';
import { cn } from '../../../../shared/utils/cn';

const extractTextareaClasses = (className: string): string => {
  if (!className) return '';
  return className
    .split(' ')
    .filter(
      (cls) =>
        cls.startsWith('bg-') ||
        cls.startsWith('rounded-') ||
        cls.startsWith('text-') ||
        cls.startsWith('placeholder-'),
    )
    .join(' ');
};

const Textarea: React.FC<TextareaProps> = ({
  value = '',
  onChange,
  placeholder,
  error,
  helperText,
  maxLength,
  showCount = false,
  autoResize = false,
  rows = 4,
  minRows = 1,
  maxRows,
  disabled = false,
  readOnly = false,
  required = false,
  className = '',
  resize = 'none',
  bottomWrapper,
  ...props
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [lineHeight, setLineHeight] = useState<number>(20);
  const [calculatedMinRows, setCalculatedMinRows] = useState<number>(1);

  useEffect(() => {
    if (textareaRef.current) {
      const computed = getComputedStyle(textareaRef.current);
      const lh = parseInt(computed.lineHeight) || 20;
      setLineHeight(lh);

      // Tính toán minRows nếu là "auto"
      if (minRows === 'auto') {
        const parentHeight = textareaRef.current.parentElement?.clientHeight || 0;
        if (parentHeight > 0) {
          const calculatedRows = Math.floor(parentHeight / lh);
          setCalculatedMinRows(Math.max(1, calculatedRows));
        }
      } else {
        setCalculatedMinRows(typeof minRows === 'number' ? minRows : 1);
      }
    }
  }, [minRows]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;

    if (maxLength && newValue.length > maxLength) {
      return;
    }

    if (onChange) {
      onChange(newValue);
    }

    // Chỉ điều chỉnh chiều cao nếu có maxRows hoặc autoResize
    if (textareaRef.current && (maxRows !== undefined || autoResize)) {
      adjustHeight();
    }
  };

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const minHeight = calculatedMinRows * lineHeight;

    // Nếu không có maxRows, không tự động tăng height
    if (maxRows === undefined) {
      textarea.style.height = `${minHeight}px`;
      textarea.style.overflowY = 'auto';
      return;
    }

    const maxHeight = maxRows * lineHeight;

    // Reset về auto để tính đúng scrollHeight
    textarea.style.height = 'auto';

    const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);

    textarea.style.height = `${newHeight}px`;

    // Hiển thị scrollbar nếu vượt quá maxHeight
    if (textarea.scrollHeight > maxHeight) {
      textarea.style.overflowY = 'auto';
    } else {
      textarea.style.overflowY = autoResize ? 'hidden' : 'auto';
    }
  };

  useEffect(() => {
    if (maxRows !== undefined || autoResize) {
      adjustHeight();
    }
  }, [value, autoResize, lineHeight, calculatedMinRows, maxRows]);

  const resizeClass = {
    none: 'resize-none',
    both: 'resize',
    horizontal: 'resize-x',
    vertical: 'resize-y',
  }[resize];

  const characterCount = value.length;
  const showCharCount = showCount || !!maxLength;

  const minHeight = calculatedMinRows * lineHeight;
  const maxHeight = maxRows !== undefined ? maxRows * lineHeight : minHeight;

  return (
    <div className={cn('px-3 py-2', className)}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        className={cn('w-full outline-none', resizeClass, extractTextareaClasses(className))}
        style={{
          minHeight: `${minHeight}px`,
          maxHeight: maxRows !== undefined ? `${maxHeight}px` : undefined,
          height: maxRows === undefined ? `${minHeight}px` : undefined,
          resize: autoResize ? 'none' : resize,
        }}
        {...props}
      />
      {bottomWrapper && <div>{bottomWrapper}</div>}
    </div>
  );
};

export default Textarea;
