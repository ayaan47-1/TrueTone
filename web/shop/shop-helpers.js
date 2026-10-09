function cleanProductTitle(value) {
  return typeof value === 'string' ? value.replace(/[<>]/g, '').trim().replace(/\s+/g, ' ') : '';
}

export function createProductAddController(add, { enabled = true } = {}) {
  let pending = false;
  return {
    canAttempt(variantAvailable) {
      return enabled && !pending && Boolean(variantAvailable);
    },
    async add(variantId) {
      if (!enabled || pending) throw new Error('Product add is unavailable');
      pending = true;
      try {
        return await add(variantId, 1);
      } finally {
        pending = false;
      }
    },
  };
}

export function neutralProductAlt(title) {
  const cleanTitle = cleanProductTitle(title);
  return cleanTitle ? `${cleanTitle} product image` : 'Product image';
}

export function productImageForVariant(variant, productImage) {
  return variant?.image ?? productImage ?? null;
}

export function productSoldOut(product) {
  return product.variants.length > 0 && product.variants.every((variant) => !variant.availableForSale);
}

export function parseCartQuantity(value, quantityAvailable) {
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) return null;
  const quantity = Number(text);
  const inventoryLimit = Number.isInteger(quantityAvailable) && quantityAvailable >= 0
    ? quantityAvailable
    : 99;
  return quantity >= 1 && quantity <= Math.min(99, inventoryLimit) ? quantity : null;
}

export function removalFocusTarget(lines, removedIndex) {
  return lines[removedIndex + 1]?.id ?? lines[removedIndex - 1]?.id ?? null;
}
