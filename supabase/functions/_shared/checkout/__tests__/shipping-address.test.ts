import { checkoutRequestSchema, shippingAddressSchema } from '../shipping-address';

const validAddress = {
  name: '  Jordan Rivera  ',
  line1: '  123 Maple Street  ',
  line2: '  Apt 4B  ',
  city: '  Chicago  ',
  state: 'il',
  postalCode: '60601-1234',
  country: 'us',
};

describe('shippingAddressSchema', () => {
  it('accepts a complete US address and normalizes its strings', () => {
    expect(shippingAddressSchema.safeParse(validAddress)).toEqual({
      success: true,
      data: {
        name: 'Jordan Rivera',
        line1: '123 Maple Street',
        line2: 'Apt 4B',
        city: 'Chicago',
        state: 'IL',
        postalCode: '60601-1234',
        country: 'US',
      },
    });
  });

  it('allows line 2 to be omitted or blank', () => {
    const { line2: _line2, ...withoutLine2 } = validAddress;
    expect(shippingAddressSchema.safeParse(withoutLine2)).toMatchObject({ success: true });
    const blankLine2 = shippingAddressSchema.safeParse({ ...validAddress, line2: '   ' });
    expect(blankLine2).toMatchObject({ success: true });
    if (blankLine2.success) expect(blankLine2.data.line2).toBeUndefined();
  });

  it.each([
    [{ ...validAddress, name: '   ' }, 'name'],
    [{ ...validAddress, name: 'x'.repeat(101) }, 'name'],
    [{ ...validAddress, line1: 'x'.repeat(201) }, 'line1'],
    [{ ...validAddress, line2: 'x'.repeat(201) }, 'line2'],
    [{ ...validAddress, city: 'x'.repeat(101) }, 'city'],
    [{ ...validAddress, state: 'Illinois' }, 'state'],
    [{ ...validAddress, postalCode: 'ABC' }, 'postalCode'],
    [{ ...validAddress, country: 'CA' }, 'country'],
    [{ ...validAddress, nickname: 'home' }, 'nickname'],
  ])('rejects an invalid or unknown address field (%s)', (address, path) => {
    const result = shippingAddressSchema.safeParse(address);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.path).toBe(path);
  });
});

describe('checkoutRequestSchema', () => {
  const items = [{ product: { id: 'p1' }, qty: 1 }];

  it('accepts items with a valid shipping address', () => {
    expect(checkoutRequestSchema.safeParse({ items, shippingAddress: validAddress })).toMatchObject({
      success: true,
    });
  });

  it.each([
    null,
    { items },
    { items: [], shippingAddress: validAddress },
    { items, shippingAddress: validAddress, amount: 1 },
    { items, shippingAddress: { ...validAddress, postalCode: 'nope' } },
  ])('rejects an invalid request body (%p)', (body) => {
    expect(checkoutRequestSchema.safeParse(body).success).toBe(false);
  });
});
