'use client';

interface AppPreviewProps {
  title: string;
  url: string;
  description: string;
}

export function AppPreview({ title, url, description }: AppPreviewProps) {
  return (
    <div className="group relative">
      <div className="aspect-video w-full rounded-lg border-2 border-border bg-card overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300">
        <div className="relative h-full">
          <iframe
            src={url}
            className="w-full h-full pointer-events-none scale-50 origin-top-left"
            style={{
              width: '200%',
              height: '200%',
              transform: 'scale(0.5)',
              transformOrigin: 'top left'
            }}
            title={title}
            loading="lazy"
          />
          {/* Click overlay */}
          <div 
            className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors cursor-pointer flex items-center justify-center opacity-0 hover:opacity-100"
            onClick={() => window.open(url, '_blank')}
          >
            <div className="bg-white/90 dark:bg-black/90 px-4 py-2 rounded-lg text-sm font-medium">
              Click to open app →
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 text-center">
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
    </div>
  );
}
