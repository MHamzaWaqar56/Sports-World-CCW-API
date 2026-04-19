import mongoose from 'mongoose';

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true, // har user ka ek cart
  },
  products: [
    {
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      quantity: { type: Number, default: 1 },
      variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
      variantName: { type: String, default: '' },
      variantSku: { type: String, default: '' },
      variantPrice: { type: Number, default: 0 },
      variantImage: { type: String, default: '' },
      variantAttributes: { type: Array, default: [] },
    },
  ],
}, { timestamps: true });

const Cart = mongoose.model('Cart', cartSchema);
export default Cart;