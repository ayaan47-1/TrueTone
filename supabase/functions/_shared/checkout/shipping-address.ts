export const SHIPPING_ADDRESS_LIMITS = {
  name: 100,
  line1: 200,
  line2: 200,
  city: 100,
  state: 2,
  postalCode: 10,
  country: 2,
} as const;

export interface ShippingAddressDraft {
  name: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface ShippingAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: 'US';
}

export type ShippingAddressField = keyof ShippingAddressDraft;
export type ShippingAddressErrors = Partial<Record<ShippingAddressField, string>>;

export const EMPTY_SHIPPING_ADDRESS: ShippingAddressDraft = {
  name: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'US',
};

const ADDRESS_KEYS = Object.keys(EMPTY_SHIPPING_ADDRESS) as ShippingAddressField[];
const ADDRESS_KEY_SET = new Set<string>(ADDRESS_KEYS);
const REQUEST_KEYS = new Set(['items', 'shippingAddress']);

interface SchemaError {
  path: string;
  message: string;
}

type SchemaResult<T> =
  | { success: true; data: T }
  | { success: false; error: SchemaError };

interface CheckoutItem {
  product: { id: string; price?: number; [key: string]: unknown };
  qty: number;
  [key: string]: unknown;
}

export interface CheckoutRequest {
  items: CheckoutItem[];
  shippingAddress: ShippingAddress;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function trimmedString(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() : null;
}

/** Returns every field error so the controlled form can show clear inline feedback. */
export function getShippingAddressErrors(value: unknown): ShippingAddressErrors {
  if (!isRecord(value)) return { name: 'Enter the recipient’s full name.' };

  const errors: ShippingAddressErrors = {};
  const name = trimmedString(value.name);
  const line1 = trimmedString(value.line1);
  const line2 = value.line2 === undefined ? '' : trimmedString(value.line2);
  const city = trimmedString(value.city);
  const state = trimmedString(value.state);
  const postalCode = trimmedString(value.postalCode);
  const country = trimmedString(value.country);

  if (!name) errors.name = 'Enter the recipient’s full name.';
  else if (name.length > SHIPPING_ADDRESS_LIMITS.name) {
    errors.name = `Use ${SHIPPING_ADDRESS_LIMITS.name} characters or fewer.`;
  }

  if (!line1) errors.line1 = 'Enter a street address.';
  else if (line1.length > SHIPPING_ADDRESS_LIMITS.line1) {
    errors.line1 = `Use ${SHIPPING_ADDRESS_LIMITS.line1} characters or fewer.`;
  }

  if (line2 === null) errors.line2 = 'Address line 2 must be text.';
  else if (line2.length > SHIPPING_ADDRESS_LIMITS.line2) {
    errors.line2 = `Use ${SHIPPING_ADDRESS_LIMITS.line2} characters or fewer.`;
  }

  if (!city) errors.city = 'Enter a city.';
  else if (city.length > SHIPPING_ADDRESS_LIMITS.city) {
    errors.city = `Use ${SHIPPING_ADDRESS_LIMITS.city} characters or fewer.`;
  }

  if (!state || !/^[A-Za-z]{2}$/.test(state)) errors.state = 'Enter a 2-letter state.';
  if (!postalCode || !/^\d{5}(?:-\d{4})?$/.test(postalCode)) {
    errors.postalCode = 'Enter a valid ZIP code.';
  }
  if (!country || country.toUpperCase() !== 'US') {
    errors.country = 'Shipping is available in the US only.';
  }

  return errors;
}

function parseShippingAddress(value: unknown): SchemaResult<ShippingAddress> {
  if (!isRecord(value)) {
    return { success: false, error: { path: 'shippingAddress', message: 'Address is required.' } };
  }

  const unknownKey = Object.keys(value).find((key) => !ADDRESS_KEY_SET.has(key));
  if (unknownKey) {
    return { success: false, error: { path: unknownKey, message: 'Unknown address field.' } };
  }

  const errors = getShippingAddressErrors(value);
  const firstError = ADDRESS_KEYS.find((key) => errors[key]);
  if (firstError) {
    return { success: false, error: { path: firstError, message: errors[firstError]! } };
  }

  const line2 = typeof value.line2 === 'string' ? value.line2.trim() : '';
  return {
    success: true,
    data: {
      name: (value.name as string).trim(),
      line1: (value.line1 as string).trim(),
      ...(line2 ? { line2 } : {}),
      city: (value.city as string).trim(),
      state: (value.state as string).trim().toUpperCase(),
      postalCode: (value.postalCode as string).trim(),
      country: 'US',
    },
  };
}

/** Strict runtime schema shared by the app and the create-payment-intent edge function. */
export const shippingAddressSchema = {
  safeParse: parseShippingAddress,
};

function parseCheckoutRequest(value: unknown): SchemaResult<CheckoutRequest> {
  if (!isRecord(value)) {
    return { success: false, error: { path: '', message: 'Request body must be an object.' } };
  }

  const unknownKey = Object.keys(value).find((key) => !REQUEST_KEYS.has(key));
  if (unknownKey) {
    return { success: false, error: { path: unknownKey, message: 'Unknown request field.' } };
  }
  if (!Array.isArray(value.items) || value.items.length === 0) {
    return { success: false, error: { path: 'items', message: 'At least one item is required.' } };
  }

  const address = shippingAddressSchema.safeParse(value.shippingAddress);
  if (!address.success) return address;

  return {
    success: true,
    data: {
      items: value.items as CheckoutItem[],
      shippingAddress: address.data,
    },
  };
}

/** Rejects unknown top-level keys and returns only normalized, validated data. */
export const checkoutRequestSchema = {
  safeParse: parseCheckoutRequest,
};
