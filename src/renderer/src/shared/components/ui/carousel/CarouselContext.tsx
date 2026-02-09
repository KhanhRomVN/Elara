import { createContext } from 'react';
import { CarouselContextValue } from './Carousel.types';

export const CarouselContext = createContext<CarouselContextValue | null>(null);
