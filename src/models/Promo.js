import mongoose from 'mongoose';

const promoSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    discountPercentage: {
      type: Number,
      required: true,
      min: 1,
      max: 99,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    expiryDate: {
      type: Date,
      default: null,
    },
    // ── New fields ──────────────────────────────
    maxUses: {
      type: Number,
      default: null, // null = unlimited
    },
    usedCount: {
      type: Number,
      default: 0,
    },
    totalDiscountGiven: {
      type: Number,
      default: 0, // total PKR discount given across all orders
    },
  },
  { timestamps: true }
);

const Promo = mongoose.model('Promo', promoSchema);
export default Promo;