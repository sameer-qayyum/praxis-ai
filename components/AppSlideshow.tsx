'use client';

import { useState, useEffect } from 'react';

interface App {
  title: string;
  url: string;
  description: string;
}

interface AppSlideshowProps {
  apps: App[];
}

export function AppSlideshow({ apps }: AppSlideshowProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Auto-rotate every 4 seconds, but pause on hover
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % apps.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [apps.length, isPaused]);

  const currentApp = apps[currentIndex];
  
  // Dynamic build times for each app (1-4 hours)
  const buildTimes = [2, 1, 3, 4, 2, 3]; // hours for each app
  const currentBuildTime = buildTimes[currentIndex];

  return (
    <div className="relative">
      <div className="sticky top-8">
        <div className="text-sm font-medium text-muted-foreground mb-3">
          ↗ Here's what Praxis built for other users:
        </div>
        <div 
          className="aspect-[4/3] w-full rounded-lg border-2 border-border bg-card shadow-lg overflow-hidden"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <div className="h-full flex flex-col">
            {/* Dynamic app header */}
            <div className="bg-praxis-700 text-white px-4 py-3 text-sm font-medium">
              {currentApp.title}
            </div>
            {/* App iframe content */}
            <div className="flex-1 relative">
              {/* Preload all iframes, show only current one */}
              {apps.map((app, index) => (
                <iframe
                  key={app.url}
                  src={app.url}
                  className={`absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-300 ${
                    index === currentIndex ? 'opacity-100' : 'opacity-0'
                  }`}
                  style={{
                    width: '200%',
                    height: '200%',
                    transform: 'scale(0.5)',
                    transformOrigin: 'top left'
                  }}
                  title={app.title}
                  loading="lazy"
                />
              ))}
              {/* Click overlay */}
              <div 
                className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors cursor-pointer flex items-center justify-center opacity-0 hover:opacity-100 z-10"
                onClick={() => window.open(currentApp.url, '_blank')}
              >
                <div className="bg-white/90 dark:bg-black/90 px-4 py-2 rounded-lg text-sm font-medium">
                  Click to open app →
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-between items-center mt-3">
          <div className="text-xs text-muted-foreground italic">
            Built from Google Sheet using Praxis in {currentBuildTime} hour{currentBuildTime > 1 ? 's' : ''}
          </div>
          {/* Slideshow indicators */}
          <div className="flex gap-1">
            {apps.map((_, index) => (
              <button
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentIndex 
                    ? 'bg-praxis-700 dark:bg-praxis-400' 
                    : 'bg-muted-foreground/30'
                }`}
                onClick={() => setCurrentIndex(index)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
