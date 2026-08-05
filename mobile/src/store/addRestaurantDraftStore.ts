import { create } from 'zustand';

interface SelectedLocation {
  lat: number;
  lng: number;
}

interface AddRestaurantDraftState {
  selectedLocation: SelectedLocation | null;
  setSelectedLocation: (location: SelectedLocation) => void;
  clear: () => void;
}

/**
 * Transient (not persisted) cross-screen handoff for AddRestaurantScreen's
 * "Vị trí" step <-> SelectLocationScreen — avoids adding a `selectedLocation`
 * param to `MainStackParamList['AddRestaurant']` just to shuttle one value
 * back on `goBack()`. Cleared once AddRestaurantScreen consumes it.
 */
export const useAddRestaurantDraftStore = create<AddRestaurantDraftState>((set) => ({
  selectedLocation: null,
  setSelectedLocation: (location) => set({ selectedLocation: location }),
  clear: () => set({ selectedLocation: null }),
}));
