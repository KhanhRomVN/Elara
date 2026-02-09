export { default as Avatar } from './Avatar';
export type {
  AvatarProps,
  AvatarSize,
  AvatarShape,
  AvatarIcon,
  AvatarFallbackType,
  AvatarSizeConfig,
  AvatarIconDotConfig,
} from './Avatar.types';
export {
  getAvatarSizeStyles,
  getDotSize,
  getDotPosition,
  getDotIconSize,
  getInitials,
  getFallbackBackground,
  getDefaultDotBgColor,
  validateAvatarProps,
  mergeStyles,
} from './Avatar.utils';
