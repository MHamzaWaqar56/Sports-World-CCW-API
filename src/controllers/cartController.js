import Cart from '../models/Cart.js';

const normalizeVariantId = (value) => String(value ?? '').trim();

// GET cart
export const getCart = async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id }).populate('products.product');
  if (!cart) return res.json({ products: [] });
  res.json(cart);
};


export const addToCart = async (req, res) => {
  const {
    productId,
    quantity = 1,
    variantId = null,
    variantName = '',
    variantSku = '',
    variantPrice = 0,
    variantImage = '',
    variantAttributes = [],
  } = req.body;
  const normalizedVariantId = normalizeVariantId(variantId);

  let cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    cart = new Cart({
      user: req.user._id,
      products: [{ product: productId, quantity }],
    });
  } else {
    const existing = cart.products.find(
      (p) =>
        p.product.toString() === productId &&
        normalizeVariantId(p.variantId) === normalizedVariantId
    );

    const safeQty = Math.max(1, Number(quantity) || 1);
    if (existing) {
      existing.quantity = safeQty;
    } else {
      cart.products.push({
        product: productId,
        quantity: safeQty,
        variantId: normalizedVariantId || null,
        variantName: String(variantName || '').trim(),
        variantSku: String(variantSku || '').trim(),
        variantPrice: Number(variantPrice) || 0,
        variantImage: String(variantImage || '').trim(),
        variantAttributes: Array.isArray(variantAttributes) ? variantAttributes : [],
      });
    }
  }

  await cart.save();
  res.json(cart);
};

// REMOVE from cart
export const removeFromCart = async (req, res) => {
  const { productId, variantId = null } = req.body;
  const normalizedVariantId = normalizeVariantId(variantId);
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) return res.status(404).json({ message: 'Cart not found' });

  cart.products = cart.products.filter(
    (p) => !(p.product.toString() === productId && normalizeVariantId(p.variantId) === normalizedVariantId)
  );
  await cart.save();
  res.json(cart);
};

// CLEAR cart
export const clearCart = async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) return res.status(404).json({ message: 'Cart not found' });

  cart.products = [];
  await cart.save();
  res.json({ message: 'Cart cleared' });
};