export interface DndZoneProps {
  /**
   * Callback when files are dropped or selected
   */
  onFilesChange?: (files: File[]) => void;

  /**
   * Accept specific file types (e.g., "image/*", ".pdf", etc.)
   */
  accept?: string;

  /**
   * Allow multiple files
   * @default true
   */
  multiple?: boolean;

  /**
   * Maximum file size in bytes
   */
  maxSize?: number;

  /**
   * Maximum number of files
   */
  maxFiles?: number;

  /**
   * Disabled state
   * @default false
   */
  disabled?: boolean;

  /**
   * Custom CSS class
   */
  className?: string;

  /**
   * Height of the drop zone
   * @default "200px"
   */
  height?: string;

  /**
   * Show file preview
   * @default true
   */
  showPreview?: boolean;

  /**
   * Custom message when no files
   */
  placeholder?: string;

  /**
   * Show file size
   * @default true
   */
  showFileSize?: boolean;

  /**
   * Allow removing files
   * @default true
   */
  allowRemove?: boolean;
}

export interface FileWithPreview extends File {
  preview?: string;
}
