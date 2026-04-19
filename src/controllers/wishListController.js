import Wishlist from '../models/WishList.js';

// GET wishlist
export const getWishlist = async (req, res) => {
  const wishlist = await Wishlist.findOne({ user: req.user._id }).populate('products');

  if (!wishlist) {
    return res.json({ products: [] });
  }

  res.json(wishlist);
};

// ADD item (single add without toggle, optional)
export const addToWishlist = async (req, res) => {
  const { productId } = req.body;

  let wishlist = await Wishlist.findOne({ user: req.user._id });

  if (!wishlist) {
    wishlist = new Wishlist({
      user: req.user._id,
      products: [productId],
    });
  } else {
    if (!wishlist.products.includes(productId)) {
      wishlist.products.push(productId);
    }
  }

  await wishlist.save();
  res.json(wishlist);
};

// REMOVE item
export const removeFromWishlist = async (req, res) => {
  const { productId } = req.body;

  const wishlist = await Wishlist.findOne({ user: req.user._id });

  if (!wishlist) return res.status(404).json({ message: 'Wishlist not found' });

  wishlist.products = wishlist.products.filter(
    (id) => id.toString() !== productId
  );

  await wishlist.save();
  res.json(wishlist);
};

// CLEAR wishlist
export const clearWishlist = async (req, res) => {
  const wishlist = await Wishlist.findOne({ user: req.user._id });

  if (!wishlist) return res.status(404).json({ message: 'Wishlist not found' });

  wishlist.products = [];
  await wishlist.save();

  res.json({ message: 'Wishlist cleared' });
};

// 🔹 TOGGLE wishlist
export const toggleWishlist = async (req, res) => {
  const { productId } = req.body;

  let wishlist = await Wishlist.findOne({ user: req.user._id });

  if (!wishlist) {
    wishlist = new Wishlist({
      user: req.user._id,
      products: [productId],
    });
    await wishlist.save();
    return res.json({ added: true, removed: false, wishlist });
  }

  // Check if product already exists
  const exists = wishlist.products.some(
    (id) => id.toString() === productId
  );

  if (exists) {
    // Remove product
    wishlist.products = wishlist.products.filter(
      (id) => id.toString() !== productId
    );
    await wishlist.save();
    return res.json({ added: false, removed: true, wishlist });
  }

  // Add product
  wishlist.products.push(productId);
  await wishlist.save();
  res.json({ added: true, removed: false, wishlist });
};