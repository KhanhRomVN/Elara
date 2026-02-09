/**
 * Format file size to human readable format
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Check if file type is accepted
 */
export const isFileTypeAccepted = (file: File, accept?: string): boolean => {
  if (!accept) return true;

  const acceptedTypes = accept.split(',').map((type) => type.trim());

  return acceptedTypes.some((type) => {
    if (type.startsWith('.')) {
      // Extension check
      return file.name.toLowerCase().endsWith(type.toLowerCase());
    } else if (type.endsWith('/*')) {
      // Wildcard check (e.g., "image/*")
      const baseType = type.split('/')[0];
      return file.type.startsWith(baseType);
    } else {
      // Exact MIME type check
      return file.type === type;
    }
  });
};

/**
 * Validate file against constraints
 */
export const validateFile = (
  file: File,
  accept?: string,
  maxSize?: number,
): { valid: boolean; error?: string } => {
  if (accept && !isFileTypeAccepted(file, accept)) {
    return {
      valid: false,
      error: `File type not accepted. Expected: ${accept}`,
    };
  }

  if (maxSize && file.size > maxSize) {
    return {
      valid: false,
      error: `File size exceeds ${formatFileSize(maxSize)}`,
    };
  }

  return { valid: true };
};

/**
 * Check if file is an image
 */
export const isImageFile = (file: File): boolean => {
  return file.type.startsWith('image/');
};

/**
 * Get file icon based on type
 */
export const getFileIcon = (file: File): string => {
  const type = file.type;

  if (type.startsWith('image/')) return '🖼️';
  if (type.startsWith('video/')) return '🎥';
  if (type.startsWith('audio/')) return '🎵';
  if (type.includes('pdf')) return '📄';
  if (type.includes('zip') || type.includes('rar')) return '📦';
  if (type.includes('text')) return '📝';
  if (
    type.includes('sheet') ||
    type.includes('excel') ||
    file.name.endsWith('.xlsx') ||
    file.name.endsWith('.xls')
  )
    return '📊';
  if (
    type.includes('presentation') ||
    type.includes('powerpoint') ||
    file.name.endsWith('.pptx') ||
    file.name.endsWith('.ppt')
  )
    return '📽️';
  if (
    type.includes('document') ||
    type.includes('word') ||
    file.name.endsWith('.docx') ||
    file.name.endsWith('.doc')
  )
    return '📃';

  return '📁';
};
