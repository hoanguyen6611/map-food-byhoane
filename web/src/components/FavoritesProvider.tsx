'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

interface FavoritesContextValue {
  favoriteIds: Set<string>;
  /** false while the initial fetch is in flight — lets FavoriteButton avoid a wrong flash before we know the real state. */
  isLoaded: boolean;
  toggle: (restaurantId: string) => void;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

// Hand-rolled optimistic-update Context — mirrors mobile's
// useToggleFavorite (mobile/src/hooks/useFavorites.ts) onMutate/onError
// shape, since web has no React Query. A single shared fetch on mount (not
// one per FavoriteButton) avoids an N+1 request per card grid.
export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/favorites/ids')
      .then((res) => res.json())
      .then((ids: string[]) => {
        if (!cancelled) {
          setFavoriteIds(new Set(ids));
          setIsLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setIsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback((restaurantId: string) => {
    setFavoriteIds((prev) => {
      const wasFavorited = prev.has(restaurantId);
      const next = new Set(prev);
      if (wasFavorited) {
        next.delete(restaurantId);
      } else {
        next.add(restaurantId);
      }

      fetch(`/api/favorites/${encodeURIComponent(restaurantId)}`, {
        method: wasFavorited ? 'DELETE' : 'POST',
      })
        .then((res) => {
          if (!res.ok) throw new Error(`Favorite toggle failed: ${res.status}`);
        })
        .catch(() => {
          // Roll back on failure — matches mobile's onError rollback.
          setFavoriteIds((current) => {
            const reverted = new Set(current);
            if (wasFavorited) {
              reverted.add(restaurantId);
            } else {
              reverted.delete(restaurantId);
            }
            return reverted;
          });
        });

      return next;
    });
  }, []);

  return (
    <FavoritesContext.Provider value={{ favoriteIds, isLoaded, toggle }}>{children}</FavoritesContext.Provider>
  );
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return ctx;
}
