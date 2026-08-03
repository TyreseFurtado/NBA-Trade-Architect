import { useState } from 'react';

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
  const [hasError, setHasError] = useState(false);

  const shouldRenderImage = Boolean(nbaId) && !hasError;
  const sizeClass = `player-headshot--${size}`;

  return (
    <div className={`player-headshot ${sizeClass}`} aria-label={`${name} headshot`}>
      {shouldRenderImage ? (
        <img
          src={`https://cdn.nba.com/headshots/nba/latest/260x190/${nbaId}.png`}
          alt={`${name} headshot`}
          className="player-headshot__img rounded-full object-cover object-top"
          loading="lazy"
          onError={() => setHasError(true)}
        />
      ) : (
        <div className="player-headshot__fallback rounded-full object-cover object-top">
          <span>{getInitials(name)}</span>
        </div>
      )}
    </div>
  );
}
