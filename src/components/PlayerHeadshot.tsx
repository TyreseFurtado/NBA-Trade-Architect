import { useEffect, useMemo, useState } from 'react';

interface PlayerHeadshotProps {
  nbaId?: number | string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'TB';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function PlayerHeadshot({ nbaId, name, size = 'md' }: PlayerHeadshotProps) {
  const [activeSrcIndex, setActiveSrcIndex] = useState(0);
  const [hasFailed, setHasFailed] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const imageSources = useMemo(() => {
    if (!nbaId) return [];
    return [
      `https://cdn.nba.com/headshots/nba/latest/260x190/${nbaId}.png`,
      `https://a.espncdn.com/i/headshots/nba/players/full/${nbaId}.png`,
    ];
  }, [nbaId]);

  useEffect(() => {
    setActiveSrcIndex(0);
    setHasFailed(false);
    setIsLoaded(false);
  }, [nbaId]);

  const shouldRenderImage = Boolean(nbaId) && !hasFailed && imageSources.length > 0;
  const sizeClass = `player-headshot--${size}`;

  const handleImageError = () => {
    if (activeSrcIndex < imageSources.length - 1) {
      setActiveSrcIndex((current) => current + 1);
      return;
    }

    setHasFailed(true);
    setIsLoaded(false);
  };

  const handleImageLoad = () => {
    setIsLoaded(true);
  };

  return (
    <div className={`player-headshot ${sizeClass}`} aria-label={`${name} headshot`}>
      {shouldRenderImage ? (
        <>
          <img
            key={`${nbaId}-${activeSrcIndex}`}
            src={imageSources[activeSrcIndex]}
            alt={`${name} headshot`}
            className="player-headshot__img rounded-full object-cover object-top"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={handleImageError}
            onLoad={handleImageLoad}
          />
          {!isLoaded && <div className="player-headshot__fallback rounded-full object-cover object-top" aria-hidden="true" />}
        </>
      ) : (
        <div className="player-headshot__fallback rounded-full object-cover object-top">
          <span>{getInitials(name)}</span>
        </div>
      )}
    </div>
  );
}
