import React, { useState, memo, useCallback } from 'react';
import './carousel.css';

/**
 * Swipeable carousel for game mode selection
 * Features: arrows, touch swipe, glowing indicator
 */
const GameModeCarousel = memo(({ options, selectedIndex, onSelect }) => {
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  const goToPrevious = useCallback(() => {
    const newIndex =
      selectedIndex === 0 ? options.length - 1 : selectedIndex - 1;
    onSelect(newIndex);
  }, [selectedIndex, options.length, onSelect]);

  const goToNext = useCallback(() => {
    const newIndex =
      selectedIndex === options.length - 1 ? 0 : selectedIndex + 1;
    onSelect(newIndex);
  }, [selectedIndex, options.length, onSelect]);

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      goToNext();
    } else if (isRightSwipe) {
      goToPrevious();
    }
  };

  const currentOption = options[selectedIndex];

  return (
    <div className="carousel-container">
      <div className="carousel-main">
        <div
          className="carousel-arrow carousel-arrow-left"
          onClick={goToPrevious}
          role="button"
          tabIndex={-1}
        >
          ‹
        </div>

        <div
          className="carousel-content"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="carousel-card">
            <h4>{currentOption.title}</h4>
            <p>{currentOption.description}</p>
          </div>
        </div>

        <div
          className="carousel-arrow carousel-arrow-right"
          onClick={goToNext}
          role="button"
          tabIndex={-1}
        >
          ›
        </div>
      </div>

      {/* Dot indicators */}
      <div className="carousel-indicators">
        {options.map((_, index) => (
          <button
            key={index}
            type="button"
            className={`carousel-dot ${index === selectedIndex ? 'active' : ''}`}
            onClick={() => onSelect(index)}
            aria-label={`Select ${options[index].title}`}
            aria-current={index === selectedIndex ? 'true' : 'false'}
          />
        ))}
      </div>
    </div>
  );
});

GameModeCarousel.displayName = 'GameModeCarousel';

export default GameModeCarousel;
