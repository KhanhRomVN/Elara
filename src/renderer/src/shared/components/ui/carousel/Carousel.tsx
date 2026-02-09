import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CarouselProps, CarouselContextValue } from './Carousel.types';
import { cn } from '../../../../shared/utils/cn';

import { getNextIndex, getPrevIndex, getTransformValue } from './Carousel.utils';
import CarouselItem from './CarouselItem';

import { CarouselContext } from './CarouselContext';

const Carousel: React.FC<CarouselProps> = ({
  // Behavior
  loop = true,
  autoplay = false,
  autoplayDelay = 3000,
  pauseOnHover = true,

  // Slides
  slidesPerView = 1,
  centered = false,
  spaceBetween = 0,

  // Transition
  effect = 'slide',
  speed = 500,
  parallax = false,

  // Navigation
  showArrows = true,
  showDots = true,
  draggable = true,

  // Data
  items = [],
  renderItem,

  // Events
  onSlideChange,
  onReachEnd,

  // Styling
  className = '',
  arrowClassName = '',
  dotClassName = '',
  children,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);

  const autoplayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalItems = items.length;

  // Navigation functions
  const goToSlide = useCallback(
    (index: number) => {
      const newIndex = Math.max(0, Math.min(index, totalItems - 1));
      setCurrentIndex(newIndex);

      if (onSlideChange) {
        onSlideChange(newIndex);
      }

      if (newIndex === totalItems - 1 && onReachEnd) {
        onReachEnd();
      }
    },
    [totalItems, onSlideChange, onReachEnd],
  );

  const nextSlide = useCallback(() => {
    if (!loop && currentIndex >= totalItems - 1) return;
    const nextIndex = (currentIndex + 1) % totalItems;
    goToSlide(nextIndex);
  }, [currentIndex, totalItems, loop, goToSlide]);

  const prevSlide = useCallback(() => {
    if (!loop && currentIndex <= 0) return;
    const prevIndex = currentIndex === 0 ? totalItems - 1 : currentIndex - 1;
    goToSlide(prevIndex);
  }, [currentIndex, totalItems, loop, goToSlide]);

  // Autoplay
  useEffect(() => {
    if (!autoplay) return;

    const shouldPause = pauseOnHover && isHovered;
    if (shouldPause) return;

    autoplayTimerRef.current = setInterval(() => {
      nextSlide();
    }, autoplayDelay);

    return () => {
      if (autoplayTimerRef.current) {
        clearInterval(autoplayTimerRef.current);
      }
    };
  }, [autoplay, autoplayDelay, pauseOnHover, isHovered, nextSlide]);

  // Drag handlers
  const handleDragStart = (clientX: number) => {
    if (!draggable) return;
    setIsDragging(true);
    setDragStartX(clientX);
    setDragOffset(0);
  };

  const handleDragMove = (clientX: number) => {
    if (!isDragging || !draggable) return;
    const offset = clientX - dragStartX;
    setDragOffset(offset);
  };

  const handleDragEnd = () => {
    if (!isDragging || !draggable) return;

    const threshold = 50; // minimum drag distance to trigger slide change

    if (dragOffset > threshold) {
      prevSlide();
    } else if (dragOffset < -threshold) {
      nextSlide();
    }

    setIsDragging(false);
    setDragOffset(0);
  };

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    handleDragStart(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    handleDragMove(e.clientX);
  };

  const handleMouseUp = () => {
    handleDragEnd();
  };

  const handleMouseLeave = () => {
    if (isDragging) {
      handleDragEnd();
    }
  };

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    handleDragStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    handleDragMove(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    handleDragEnd();
  };

  // Context value
  const contextValue: CarouselContextValue = {
    currentIndex,
    totalItems,
    goToSlide,
    nextSlide,
    prevSlide,
    effect,
    slidesPerView,
    spaceBetween,
    centered,
  };

  // Calculate transform
  const transform = getTransformValue(effect, currentIndex, slidesPerView, spaceBetween, centered);

  return (
    <CarouselContext.Provider value={contextValue}>
      <div
        ref={containerRef}
        className={cn(
          'relative w-full overflow-hidden',
          draggable && 'cursor-grab active:cursor-grabbing',
          className,
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          handleMouseLeave();
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Carousel wrapper */}
        <div
          className={cn(
            'relative w-full h-full',
            effect === 'coverflow' && 'perspective-1000',
            effect === 'cube' && 'perspective-1000 min-h-64',
            effect === 'flip' && 'perspective-1000 min-h-64',
          )}
          style={{
            perspective:
              effect === 'cube'
                ? '1200px'
                : ['coverflow', 'flip'].includes(effect)
                  ? '1000px'
                  : undefined,
          }}
        >
          {/* Slides container */}
          <div
            className={cn(
              'flex transition-transform',
              effect === 'slide' && 'will-change-transform',
              effect === 'coverflow' && 'relative flex justify-center items-center',
              effect === 'cube' && 'relative',
              effect === 'flip' && 'relative',
              effect === 'parallax' && 'will-change-transform',
            )}
            style={{
              transform:
                effect === 'slide'
                  ? transform
                  : effect === 'cube'
                    ? `rotateY(${-currentIndex * 90}deg)`
                    : undefined,
              transitionDuration: isDragging ? '0ms' : `${speed}ms`,
              gap: effect === 'slide' ? `${spaceBetween}px` : undefined,
              transformStyle: effect === 'cube' || effect === 'flip' ? 'preserve-3d' : undefined,
            }}
          >
            {children
              ? React.Children.map(children, (child, index) => {
                  if (React.isValidElement(child)) {
                    return React.cloneElement(child as React.ReactElement<any>, {
                      index,
                    });
                  }
                  return child;
                })
              : items.map((item, index) => (
                  <CarouselItem key={index} index={index}>
                    {renderItem(item, index)}
                  </CarouselItem>
                ))}
          </div>
        </div>

        {/* Navigation arrows */}
        {showArrows && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                prevSlide();
              }}
              disabled={!loop && currentIndex === 0}
              className={cn(
                'absolute left-4 top-1/2 -translate-y-1/2 z-10',
                'w-10 h-10 rounded-full flex items-center justify-center',
                'bg-white/80 hover:bg-white shadow-lg',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-all duration-200',
                arrowClassName,
              )}
              aria-label="Previous slide"
            >
              <ChevronLeft size={20} className="text-gray-800" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                nextSlide();
              }}
              disabled={!loop && currentIndex === totalItems - 1}
              className={cn(
                'absolute right-4 top-1/2 -translate-y-1/2 z-10',
                'w-10 h-10 rounded-full flex items-center justify-center',
                'bg-white/80 hover:bg-white shadow-lg',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-all duration-200',
                arrowClassName,
              )}
              aria-label="Next slide"
            >
              <ChevronRight size={20} className="text-gray-800" />
            </button>
          </>
        )}

        {/* Dots navigation */}
        {showDots && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-2">
            {Array.from({ length: totalItems }).map((_, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation();
                  goToSlide(index);
                }}
                className={cn(
                  'w-2 h-2 rounded-full transition-all duration-200',
                  currentIndex === index ? 'bg-white w-6' : 'bg-white/50 hover:bg-white/75',
                  dotClassName,
                )}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </CarouselContext.Provider>
  );
};

export default Carousel;
