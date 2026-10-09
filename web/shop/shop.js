import {
  CART_ID_KEY,
  PRODUCTS_QUERY,
  PRODUCT_BY_HANDLE_QUERY,
  createCartApi,
  createStorefrontClient,
  formatMoney,
  isAllowedCheckoutUrl,
  mapProduct,
  readShopifyConfig,
} from './storefront.js';
import {
  createProductAddController,
  neutralProductAlt,
  parseCartQuantity,
  productImageForVariant,
  removalFocusTarget,
} from './shop-helpers.js';

const SHOP_ENTRY_KEY = 'truetone.shop.entry.v1';
const PRODUCT_CACHE_KEY = 'truetone.shop.products.v1';
const PRODUCT_CACHE_MS = 15 * 60 * 1000;

function requireShopEntry() {
  if (sessionStorage.getItem(SHOP_ENTRY_KEY) === 'accepted') return Promise.resolve();
  const dialog = document.querySelector('[data-shop-entry]');
  const enter = dialog?.querySelector('[data-enter-shop]');
  if (!dialog || !enter) return Promise.reject(new Error('Shop disclosure is unavailable'));
  dialog.showModal();
  return new Promise((resolve) => {
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      location.assign('/');
    });
    enter.addEventListener('click', () => {
      sessionStorage.setItem(SHOP_ENTRY_KEY, 'accepted');
      dialog.close();
      resolve();
    }, { once: true });
  });
}

function setupPrivacyChoices() {
  const dialog = document.querySelector('[data-privacy-dialog]');
  if (!dialog) return;
  for (const button of document.querySelectorAll('[data-open-privacy]')) {
    button.addEventListener('click', () => dialog.showModal());
  }
  dialog.querySelector('[data-close-privacy]')?.addEventListener('click', () => dialog.close());
}

function setStatus(message, tone) {
  const status = document.querySelector('[data-shop-status]');
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone ?? '';
}

function productImage(image, title) {
  const frame = document.createElement('div');
  frame.className = image ? 'product-image' : 'product-placeholder';
  if (!image) {
    frame.textContent = 'Image unavailable';
    return frame;
  }
  const element = document.createElement('img');
  element.src = image.url;
  element.alt = neutralProductAlt(title);
  element.width = image.width || 1200;
  element.height = image.height || 1200;
  element.loading = 'lazy';
  element.decoding = 'async';
  element.referrerPolicy = 'no-referrer';
  element.addEventListener('error', () => {
    frame.className = 'product-placeholder';
    frame.replaceChildren('Image unavailable');
  }, { once: true });
  frame.append(element);
  return frame;
}

function firstAvailable(product) {
  return product.variants.find((variant) => variant.availableForSale) ?? product.variants[0] ?? null;
}

function writeProductCache(products) {
  sessionStorage.setItem(PRODUCT_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), products }));
}

function readProductCache() {
  try {
    const cached = JSON.parse(sessionStorage.getItem(PRODUCT_CACHE_KEY));
    if (!cached?.savedAt || !Array.isArray(cached.products)) return null;
    return cached;
  } catch {
    return null;
  }
}

function renderCollection(products) {
  const grid = document.querySelector('[data-product-grid]');
  if (!grid) return;
  grid.replaceChildren();
  for (const product of products) {
    const article = document.createElement('article');
    article.className = 'product-card';
    const link = document.createElement('a');
    link.href = `/shop/product.html?handle=${encodeURIComponent(product.handle)}`;
    link.append(productImage(product.image, product.title));
    const title = document.createElement('h2');
    title.textContent = product.title;
    const vendor = document.createElement('p');
    vendor.className = 'product-vendor';
    vendor.textContent = product.vendor;
    const variant = firstAvailable(product);
    const price = document.createElement('p');
    price.className = 'product-price';
    price.textContent = variant ? formatMoney(variant.price) : 'Unavailable';
    link.append(title, vendor, price);
    article.append(link);
    grid.append(article);
  }
}

async function showCollection(client) {
  setStatus('Loading products…');
  try {
    const data = await client.request(PRODUCTS_QUERY, { first: 24 });
    const products = (data.products?.nodes ?? []).map(mapProduct);
    writeProductCache(products);
    renderCollection(products);
    setStatus(products.length ? '' : 'No products are available right now.');
  } catch {
    const cached = readProductCache();
    if (cached?.products.length) {
      renderCollection(cached.products);
      setStatus(`Showing saved product details from ${new Date(cached.savedAt).toLocaleString()}. Price and availability may have changed.`);
      return;
    }
    setStatus('The Shop is unavailable right now. Check your connection and try again.', 'error');
  }
}

function populateProduct(product, cart, { canAdd = true } = {}) {
  const detail = document.querySelector('[data-product-detail]');
  const media = document.querySelector('[data-product-media]');
  const picker = document.querySelector('[data-variant-picker]');
  const add = document.querySelector('[data-add-to-cart]');
  if (!detail || !media || !picker || !add) return;
  document.querySelector('[data-product-vendor]').textContent = product.vendor;
  document.querySelector('[data-product-title]').textContent = product.title;
  document.title = `${product.title} | TrueTone Shop`;
  picker.replaceChildren();
  for (const variant of product.variants) {
    const option = document.createElement('option');
    option.value = variant.id;
    option.disabled = !variant.availableForSale;
    option.textContent = `${variant.title} | ${formatMoney(variant.price)}${variant.availableForSale ? '' : ' (unavailable)'}`;
    picker.append(option);
  }
  const addController = createProductAddController((variantId, quantity) => cart.add(variantId, quantity), {
    enabled: canAdd,
  });
  const syncSelection = ({ clearStatus = false } = {}) => {
    const variant = product.variants.find((item) => item.id === picker.value);
    document.querySelector('[data-product-price]').textContent = variant ? formatMoney(variant.price) : '';
    media.replaceChildren(productImage(productImageForVariant(variant, product.image), product.title));
    add.disabled = !addController.canAttempt(variant?.availableForSale);
    add.textContent = canAdd ? 'Add to cart' : 'Unavailable offline';
    if (clearStatus) setStatus('');
  };
  picker.addEventListener('change', () => syncSelection({ clearStatus: true }));
  const available = firstAvailable(product);
  if (available) picker.value = available.id;
  syncSelection();
  document.querySelector('[data-fulfillment]').textContent =
    `Sold by TrueTone; fulfilled by ${product.vendor}. ${product.vendor} receives your name, contact details, delivery address, items ordered, and return or support information only as needed to fulfill and support this order. It does not receive your TrueTone photo, scan, scores, skin profile, or recommendation reason.`;
  add.addEventListener('click', async () => {
    add.disabled = true;
    add.textContent = 'Adding…';
    try {
      const updated = await addController.add(picker.value);
      updateCartCount(updated.totalQuantity);
      add.textContent = 'Added to cart';
      setStatus(`${product.title} added to cart.`);
    } catch {
      add.textContent = 'Try again';
      setStatus('This item could not be added. Check your connection and try again.', 'error');
    } finally {
      const variant = product.variants.find((item) => item.id === picker.value);
      add.disabled = !addController.canAttempt(variant?.availableForSale);
    }
  });
  detail.hidden = false;
  setStatus('');
}

async function showProduct(client, cart) {
  const handle = new URLSearchParams(location.search).get('handle') ?? '';
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(handle)) {
    setStatus('This product link is invalid.', 'error');
    return;
  }
  setStatus('Loading product…');
  try {
    const data = await client.request(PRODUCT_BY_HANDLE_QUERY, { handle });
    if (!data.product) {
      setStatus('This product is no longer available.');
      return;
    }
    const product = mapProduct(data.product);
    const cached = readProductCache()?.products ?? [];
    writeProductCache([...cached.filter((item) => item.handle !== product.handle), product]);
    populateProduct(product, cart);
  } catch {
    const product = readProductCache()?.products.find((item) => item.handle === handle);
    if (product) {
      populateProduct(product, cart, { canAdd: false });
      setStatus('Showing saved details. Adding to cart remains unavailable until you reconnect.');
      return;
    }
    setStatus('This product is unavailable right now. Check your connection and try again.', 'error');
  }
}

function updateCartCount(value) {
  for (const count of document.querySelectorAll('[data-cart-count]')) count.textContent = String(value ?? 0);
}

function restoreCartFocus(focus) {
  if (!focus) return;
  queueMicrotask(() => {
    const selector = focus.kind === 'quantity' ? '[data-line-quantity]' : '[data-line-remove]';
    const target = [...document.querySelectorAll(selector)].find((element) => element.dataset[focus.kind === 'quantity' ? 'lineQuantity' : 'lineRemove'] === focus.lineId);
    (target ?? document.querySelector('[data-cart-heading]'))?.focus();
  });
}

function renderCart(cart, cartApi, focus = null) {
  const lines = document.querySelector('[data-cart-lines]');
  const summary = document.querySelector('[data-cart-summary]');
  if (!lines || !summary) return;
  lines.replaceChildren();
  updateCartCount(cart.totalQuantity);
  if (!cart.lines.length) {
    setStatus('Your cart is empty.');
    summary.hidden = true;
    restoreCartFocus(focus);
    return;
  }
  setStatus('');
  for (const line of cart.lines) {
    const row = document.createElement('article');
    row.className = 'cart-line';
    const info = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = line.merchandise.product.title;
    const meta = document.createElement('p');
    meta.className = 'cart-line-meta';
    meta.textContent = `${line.merchandise.title} · ${formatMoney(line.merchandise.price)}`;
    info.append(title, meta);
    const actions = document.createElement('div');
    actions.className = 'cart-line-actions';
    const label = document.createElement('label');
    label.textContent = 'Quantity';
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '1';
    input.max = String(Math.min(99, line.merchandise.quantityAvailable ?? 99));
    input.value = String(line.quantity);
    input.inputMode = 'numeric';
    input.dataset.lineQuantity = line.id;
    input.setAttribute('aria-label', `Quantity for ${line.merchandise.product.title}`);
    input.addEventListener('change', async () => {
      const quantity = parseCartQuantity(input.value, line.merchandise.quantityAvailable);
      if (quantity === null) {
        input.value = String(line.quantity);
        setStatus('Enter a whole-number quantity from 1 through the available stock, up to 99.', 'error');
        input.focus();
        return;
      }
      input.disabled = true;
      try {
        renderCart(await cartApi.update(line.id, quantity), cartApi, { kind: 'quantity', lineId: line.id });
      } catch {
        input.value = String(line.quantity);
        setStatus('The quantity could not be updated. Try again.', 'error');
      } finally {
        input.disabled = false;
      }
    });
    label.append(input);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.dataset.lineRemove = line.id;
    remove.setAttribute('aria-label', `Remove ${line.merchandise.product.title}`);
    remove.addEventListener('click', async () => {
      remove.disabled = true;
      try {
        const index = cart.lines.findIndex((item) => item.id === line.id);
        const nextLineId = removalFocusTarget(cart.lines, index);
        renderCart(await cartApi.remove(line.id), cartApi, nextLineId
          ? { kind: 'remove', lineId: nextLineId }
          : { kind: 'heading' });
      } catch {
        setStatus('The item could not be removed. Try again.', 'error');
        remove.disabled = false;
      }
    });
    actions.append(label, remove);
    row.append(info, actions);
    lines.append(row);
  }
  document.querySelector('[data-cart-subtotal]').textContent = formatMoney(cart.subtotal);
  summary.hidden = false;
  restoreCartFocus(focus);
}

async function showCart(cartApi, config) {
  setStatus('Loading cart…');
  try {
    renderCart(await cartApi.load(), cartApi);
  } catch {
    setStatus('Your cart is unavailable right now. Check your connection and try again.', 'error');
    return;
  }
  document.querySelector('[data-checkout]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Opening checkout…';
    try {
      const freshCart = await cartApi.load();
      if (!freshCart.lines.length) throw new Error('Cart is empty');
      if (!isAllowedCheckoutUrl(freshCart.checkoutUrl, config.checkoutHosts)) throw new Error('Invalid checkout URL');
      location.assign(freshCart.checkoutUrl);
    } catch {
      setStatus('Checkout could not be opened. Your cart is unchanged; please try again.', 'error');
      button.disabled = false;
      button.textContent = 'Continue to checkout';
    }
  });
}

async function boot() {
  setupPrivacyChoices();
  await requireShopEntry();
  const config = readShopifyConfig();
  const client = createStorefrontClient(config);
  const cart = createCartApi(client);
  const page = document.body.dataset.shopPage;
  if (page !== 'cart' && localStorage.getItem(CART_ID_KEY)) {
    cart.load().then((value) => updateCartCount(value.totalQuantity)).catch(() => {});
  }
  if (page === 'collection') await showCollection(client);
  if (page === 'product') await showProduct(client, cart);
  if (page === 'cart') await showCart(cart, config);
}

boot().catch(() => setStatus('The Shop could not start. Please try again later.', 'error'));
