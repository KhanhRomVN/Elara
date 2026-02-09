import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { DndZoneProps, FileWithPreview } from './DndZone.types';
import { formatFileSize, validateFile, isImageFile, getFileIcon } from './DndZone.utils';
import { Upload, X } from 'lucide-react';
import { cn } from '../../../../shared/utils/cn';

const DndZone: React.FC<DndZoneProps> = ({
  onFilesChange,
  accept,
  multiple = true,
  maxSize,
  maxFiles,
  disabled = false,
  className = '',
  height = '200px',
  showPreview = true,
  placeholder = 'Drag & drop files here or click to browse',
  showFileSize = true,
  allowRemove = true,
}) => {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles || disabled) return;

    setError('');
    const fileArray = Array.from(newFiles);
    const validFiles: FileWithPreview[] = [];

    // Check max files limit
    if (maxFiles && files.length + fileArray.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`);
      return;
    }

    // Validate each file
    for (const file of fileArray) {
      const validation = validateFile(file, accept, maxSize);

      if (!validation.valid) {
        setError(validation.error || 'Invalid file');
        continue;
      }

      const fileWithPreview: FileWithPreview = file;

      // Create preview for images
      if (isImageFile(file) && showPreview) {
        fileWithPreview.preview = URL.createObjectURL(file);
      }

      validFiles.push(fileWithPreview);
    }

    const updatedFiles = multiple ? [...files, ...validFiles] : validFiles;
    setFiles(updatedFiles);

    if (onFilesChange) {
      onFilesChange(updatedFiles);
    }
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (!disabled) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    // Reset input value to allow selecting the same file again
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    const updatedFiles = files.filter((_, i) => i !== index);

    // Revoke object URL to prevent memory leaks
    if (files[index].preview) {
      URL.revokeObjectURL(files[index].preview!);
    }

    setFiles(updatedFiles);

    if (onFilesChange) {
      onFilesChange(updatedFiles);
    }
  };

  // Cleanup previews on unmount
  React.useEffect(() => {
    return () => {
      files.forEach((file) => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
  }, [files]);

  return (
    <div className={`dndzone-container ${className}`.trim()}>
      {/* Drop Zone */}
      <div
        className={cn(
          'dndzone-droparea rounded-lg flex flex-col items-center justify-center transition-all duration-200 p-5',
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
          isDragging && 'bg-gray-50',
          !isDragging && 'bg-gray-100',
        )}
        style={{
          height,
          border: `2px dashed ${isDragging ? '#3b82f6' : error ? '#ef4444' : '#d1d5db'}`,
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <Upload size={48} color={isDragging ? '#3b82f6' : '#9ca3af'} className="mb-3" />

        <p
          className="text-base font-medium mb-1 text-center"
          style={{
            color: isDragging ? '#3b82f6' : '#111827',
          }}
        >
          {placeholder}
        </p>

        {accept && <p className="text-gray-500 text-xs mt-1">Accepted: {accept}</p>}

        {maxSize && <p className="text-gray-500 text-xs">Max size: {formatFileSize(maxSize)}</p>}

        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleInputChange}
          disabled={disabled}
          className="hidden"
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="dndzone-files mt-4 flex flex-col gap-2">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-3 p-3 rounded-md transition-all duration-200"
            >
              {/* Preview or Icon */}
              {file.preview ? (
                <img
                  src={file.preview}
                  alt={file.name}
                  className="w-12 h-12 object-cover rounded flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 flex items-center justify-center text-3xl flex-shrink-0">
                  {getFileIcon(file)}
                </div>
              )}

              {/* File Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium mb-0.5 overflow-hidden text-ellipsis whitespace-nowrap">
                  {file.name}
                </p>
                {showFileSize && <p className="text-xs">{formatFileSize(file.size)}</p>}
              </div>

              {/* Remove Button */}
              {allowRemove && !disabled && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  className="p-1.5 bg-transparent border-none rounded cursor-pointer flex items-center justify-center transition-colors duration-200 hover:bg-gray-100"
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <X size={18} color="var(--text-secondary)" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DndZone;
