import { describe, expect, it } from 'vitest';

import { DELIVERY_LABELS } from '@/constants';

import { deliveryLabel } from './labels';

describe('deliveryLabel', () => {
  it('labels every delivery, including hybrid', () => {
    expect(deliveryLabel('in_person')).toBe(DELIVERY_LABELS.in_person);
    expect(deliveryLabel('online')).toBe(DELIVERY_LABELS.online);
    expect(deliveryLabel('hybrid')).toBe(DELIVERY_LABELS.hybrid);
  });
});
