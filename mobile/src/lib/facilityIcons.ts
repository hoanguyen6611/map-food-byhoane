import type { Ionicons } from '@expo/vector-icons';

type IoniconName = keyof typeof Ionicons.glyphMap;

/**
 * Icon per facility CODE (unlike categories, `FacilityDto` has no curated
 * icon-key system yet — see category-icons.ts's doc comment for that
 * pattern) — the label/list itself is real (`useFacilities()`), only the
 * glyph for the 9 originally-seeded codes is still a local lookup here.
 * A facility code with no entry gets `DEFAULT_FACILITY_ICON` rather than
 * being unrenderable, same "never fabricate, just fall back" convention as
 * getCategoryIonicon.
 */
const FACILITY_ICON_BY_CODE: Record<string, IoniconName> = {
  wifi: 'wifi-outline',
  parking_car: 'car-outline',
  parking_motorbike: 'bicycle-outline',
  air_conditioner: 'snow-outline',
  outdoor_seating: 'sunny-outline',
  kid_friendly: 'happy-outline',
  pet_friendly: 'paw-outline',
  card_payment: 'card-outline',
  private_room: 'lock-closed-outline',
};

const DEFAULT_FACILITY_ICON: IoniconName = 'checkmark-circle-outline';

export function getFacilityIonicon(code: string): IoniconName {
  return FACILITY_ICON_BY_CODE[code] ?? DEFAULT_FACILITY_ICON;
}
