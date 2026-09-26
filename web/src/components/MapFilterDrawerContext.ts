"use client";

import { createContext, useContext } from "react";

export interface MapFilterDrawerSelected {
  slug: string;
  name: string;
  thumbnailUrl: string | null;
  placeTileClass: string;
  compositeScore: number | null;
  reviewCount: number;
  noRatingLabel: string;
  viewDetailLabel: string;
}

interface MapFilterDrawerState {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  /** Currently-selected restaurant on the map, or null — MapFilterDrawer
   *  renders its own compact copy of this below the filter list (see
   *  MapPageClient's floating card, which this mirrors) since the map's own
   *  floating card is hidden while the drawer covers the screen. */
  selected: MapFilterDrawerSelected | null;
}

// MapFilterDrawer is created server-side (map/page.tsx, inside the `filterSlot`
// prop) and only reaches MapPageClient as an already-built ReactNode, so
// MapPageClient can't hand it normal props directly. This context is how
// MapPageClient (the Provider, wrapping `{filterSlot}`) still exchanges state
// with it: learning when the drawer opens/closes, and handing it the
// currently-selected restaurant to show inside the drawer itself.
export const MapFilterDrawerContext =
  createContext<MapFilterDrawerState | null>(null);

export function useMapFilterDrawerState(): MapFilterDrawerState | null {
  return useContext(MapFilterDrawerContext);
}
