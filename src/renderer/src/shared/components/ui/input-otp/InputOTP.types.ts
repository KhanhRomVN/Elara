/**
 * Kích thước input OTP (percentage scale)
 */
export type InputOTPSize = number;

/**
 * Variant của input OTP
 */
export type InputOTPVariant = 'outline' | 'filled' | 'underline';

/**
 * Props chính của InputOTP component
 */
export interface InputOTPProps {
  /** Số lượng inputs */
  length?: number;

  /** Kích thước input */
  size?: InputOTPSize;

  /** Variant của input */
  variant?: InputOTPVariant;

  /** Loại input */
  type?: 'text' | 'password' | 'number';

  /** Trạng thái disabled */
  disabled?: boolean;

  /** Trạng thái loading */
  loading?: boolean;

  /** Tự động focus vào input đầu tiên */
  autoFocus?: boolean;

  /** Custom class name */
  className?: string;

  /** Change handler */
  onChange?: (value: string) => void;

  /** Complete handler */
  onComplete?: (value: string) => void;

  /** Các props HTML input khác */
  [key: string]: any;
}

/**
 * Interface cho input OTP size configuration
 */
export interface InputOTPSizeConfig {
  /** Chiều cao */
  height: string;

  /** Font size */
  fontSize: string;

  /** Border radius */
  borderRadius: string;
}
