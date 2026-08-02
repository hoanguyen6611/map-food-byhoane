import {
  clampRadiusKm,
  DEFAULT_RADIUS_KM,
  MAX_RADIUS_KM,
} from './restaurant.util';

describe('clampRadiusKm', () => {
  it('defaults to 3km when no radius is requested', () => {
    expect(clampRadiusKm(undefined)).toBe(DEFAULT_RADIUS_KM);
  });

  it('passes through a requested radius under the cap', () => {
    expect(clampRadiusKm(5)).toBe(5);
  });

  it('clamps a 50km request down to the 20km hard cap (never rejects it)', () => {
    expect(clampRadiusKm(50)).toBe(MAX_RADIUS_KM);
  });

  it('clamps an absurdly large request the same way', () => {
    expect(clampRadiusKm(100000)).toBe(MAX_RADIUS_KM);
  });
});
