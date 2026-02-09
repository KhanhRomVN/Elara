import { CarouselEffect } from './Carousel.types';

/**
 * Tính toán index tiếp theo với loop
 */
export const getNextIndex = (currentIndex: number, totalItems: number, loop: boolean): number => {
  if (currentIndex >= totalItems - 1) {
    return loop ? 0 : currentIndex;
  }
  return currentIndex + 1;
};

/**
 * Tính toán index trước với loop
 */
export const getPrevIndex = (currentIndex: number, totalItems: number, loop: boolean): number => {
  if (currentIndex <= 0) {
    return loop ? totalItems - 1 : 0;
  }
  return currentIndex - 1;
};

/**
 * Tính toán offset transform dựa trên effect
 */
export const getTransformValue = (
  effect: CarouselEffect,
  currentIndex: number,
  slidesPerView: number,
  spaceBetween: number,
  centered: boolean,
): string => {
  switch (effect) {
    case 'fade':
      return 'translate3d(0, 0, 0)';

    case 'slide':
    default: {
      const slideWidth = 100 / slidesPerView;
      const offset = centered
        ? currentIndex * slideWidth - (100 - slideWidth) / 2
        : currentIndex * slideWidth;
      return `translate3d(-${offset}%, 0, 0)`;
    }
  }
};

/**
 * Lấy opacity cho fade effect
 */
export const getOpacity = (
  effect: CarouselEffect,
  itemIndex: number,
  currentIndex: number,
  slidesPerView: number,
): number => {
  if (effect !== 'fade') return 1;

  const isInView = itemIndex >= currentIndex && itemIndex < currentIndex + slidesPerView;
  return isInView ? 1 : 0;
};

/**
 * Lấy z-index cho các effect 3D
 */
export const getZIndex = (
  effect: CarouselEffect,
  itemIndex: number,
  currentIndex: number,
): number => {
  if (effect === 'coverflow' || effect === 'cube' || effect === 'flip') {
    return itemIndex === currentIndex ? 10 : Math.abs(currentIndex - itemIndex);
  }
  return 1;
};

/**
 * Tính toán transform 3D cho coverflow
 */
export const getCoverflowTransform = (
  itemIndex: number,
  currentIndex: number,
  slidesPerView: number,
): string => {
  const diff = itemIndex - currentIndex;

  if (diff === 0) {
    return `translate3d(0, 0, 100px) rotateY(0deg) scale(1.1)`;
  }

  const translateX = diff * 60;
  const translateZ = -Math.abs(diff) * 150;
  const rotateY = diff * -45;
  const scale = 1 - Math.abs(diff) * 0.3;

  return `translate3d(${translateX}%, 0, ${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`;
};

/**
 * Tính toán transform cho cube effect
 */
export const getCubeTransform = (itemIndex: number, currentIndex: number): string => {
  const diff = itemIndex - currentIndex;

  // Cube face distance from center
  const cubeSize = 400; // Size of the cube in pixels
  const halfSize = cubeSize / 2;

  if (diff === 0) {
    // Current slide - front face
    return `translateZ(${halfSize}px) rotateY(0deg)`;
  } else if (diff === 1 || (diff < 0 && Math.abs(diff) > 1)) {
    // Next slide - right face
    return `rotateY(90deg) translateZ(${halfSize}px)`;
  } else if (diff === -1 || (diff > 0 && Math.abs(diff) > 1)) {
    // Previous slide - left face
    return `rotateY(-90deg) translateZ(${halfSize}px)`;
  } else if (Math.abs(diff) === 2) {
    // Back face
    return `rotateY(180deg) translateZ(${halfSize}px)`;
  }

  // Hidden faces
  return `rotateY(${diff * 90}deg) translateZ(${halfSize}px)`;
};

/**
 * Tính toán transform cho flip effect
 */
export const getFlipTransform = (itemIndex: number, currentIndex: number): string => {
  const diff = itemIndex - currentIndex;

  if (diff === 0) {
    return `rotateY(0deg)`;
  }

  // Only flip 180deg for immediate next/prev, hide others
  const rotateY = diff > 0 ? 180 : -180;
  return `rotateY(${rotateY}deg)`;
};

/**
 * Tính toán transform cho parallax effect
 */
export const getParallaxTransform = (
  itemIndex: number,
  currentIndex: number,
  slidesPerView: number,
): string => {
  const diff = itemIndex - currentIndex;
  const slideWidth = 100 / slidesPerView;
  const translateX = diff * slideWidth;
  const parallaxOffset = diff * 20;

  return `translate3d(calc(${translateX}% + ${parallaxOffset}px), 0, 0)`;
};

/**
 * Lấy transform dựa trên effect type
 */
export const getItemTransform = (
  effect: CarouselEffect,
  itemIndex: number,
  currentIndex: number,
  slidesPerView: number,
): string => {
  switch (effect) {
    case 'coverflow':
      return getCoverflowTransform(itemIndex, currentIndex, slidesPerView);

    case 'cube':
      return getCubeTransform(itemIndex, currentIndex);

    case 'flip':
      return getFlipTransform(itemIndex, currentIndex);

    case 'parallax':
      return getParallaxTransform(itemIndex, currentIndex, slidesPerView);

    case 'slide':
    default:
      return '';
  }
};
