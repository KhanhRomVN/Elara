import { ReactNode } from 'react';

export type CarouselEffect = 'slide' | 'fade' | 'cube' | 'coverflow' | 'flip' | 'parallax';

export interface CarouselContextValue {
  currentIndex: number;
  totalItems: number;
  goToSlide: (index: number) => void;
  nextSlide: () => void;
  prevSlide: () => void;
  effect: CarouselEffect;
  slidesPerView: number;
  spaceBetween: number;
  centered: boolean;
}

export interface CarouselProps {
  // ---- Behavior ----
  loop?: boolean;
  autoplay?: boolean;
  autoplayDelay?: number; // ms
  pauseOnHover?: boolean;

  // ---- Slides ----
  slidesPerView?: number; // số slide hiển thị
  centered?: boolean; // center mode
  spaceBetween?: number; // khoảng cách giữa slide (px)

  // ---- Transition ----
  effect?: CarouselEffect;
  speed?: number; // thời gian transition (ms)
  parallax?: boolean;

  // ---- Navigation ----
  showArrows?: boolean;
  showDots?: boolean;
  draggable?: boolean;

  // ---- Data ----
  items: any[]; // dữ liệu các slide
  renderItem: (item: any, index: number) => ReactNode;

  // ---- Events ----
  onSlideChange?: (index: number) => void;
  onReachEnd?: () => void;

  // ---- Styling ----
  className?: string;
  arrowClassName?: string;
  dotClassName?: string;
  children?: ReactNode;
}

export interface CarouselItemProps {
  children: ReactNode;
  className?: string;
  index?: number;
  [key: string]: any;
}
