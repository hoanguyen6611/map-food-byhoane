import { SetMetadata } from '@nestjs/common';

export const OWNED_RESTAURANT_PARAM_KEY = 'ownedRestaurantParam';

// Names the route param OwnerRestaurantGuard reads the restaurant id from —
// defaults to 'id' when undecorated (every OwnerRestaurantController route
// uses that name), but stays overridable since other controllers' param
// names vary (e.g. ':restaurantId').
export const OwnedRestaurantParam = (paramName: string) =>
  SetMetadata(OWNED_RESTAURANT_PARAM_KEY, paramName);
