import mongoose from 'mongoose';

const purchaseBillItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    variantName: {
      type: String,
      default: '',
      trim: true,
    },
    variantSku: {
      type: String,
      default: '',
      trim: true,
    },
    variantAttributes: {
      type: Array,
      default: [],
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
    },
    costPrice: {
      type: Number,
      required: true,
      min: [0, 'Cost price cannot be negative'],
    },
    sellingPrice: {
      type: Number,
      default: 0,
      min: [0, 'Selling price cannot be negative'],
    },
    lineTotal: {
      type: Number,
      required: true,
      min: [0, 'Line total cannot be negative'],
    },
  },
  { _id: false }
);

const purchaseBillSchema = new mongoose.Schema(
  {
    supplierName: {
      type: String,
      required: true,
      trim: true,
    },
    firmName: {
      type: String,
      default: '',
      trim: true,
    },
    mobile: {
      type: String,
      default: '',
      trim: true,
    },
    address: {
      type: String,
      default: '',
      trim: true,
    },
    gstNumber: {
      type: String,
      default: '',
      trim: true,
    },
    billNumber: {
      type: String,
      required: true,
      trim: true,
    },
    billDate: {
      type: Date,
      required: true,
    },
    items: {
      type: [purchaseBillItemSchema],
      default: [],
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    transportCharges: {
      type: Number,
      default: 0,
      min: 0,
    },
    packingCharges: {
      type: Number,
      default: 0,
      min: 0,
    },
    otherCharges: {
      type: Number,
      default: 0,
      min: 0,
    },
    extraChargesTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    finalTotal: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    pendingAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentMode: {
      type: String,
      enum: ['cash', 'online', 'pending'],
      default: 'pending',
    },
    paymentStatus: {
      type: String,
      enum: ['paid', 'partial', 'pending'],
      default: 'pending',
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    isDraft: {
      type: Boolean,
      default: false,
    },
    stockApplied: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

purchaseBillSchema.index({ billDate: -1, createdAt: -1 });
purchaseBillSchema.index({ supplierName: 1 });
purchaseBillSchema.index({ billNumber: 1 });
purchaseBillSchema.index({ paymentStatus: 1 });

const PurchaseBill = mongoose.model('PurchaseBill', purchaseBillSchema);

export default PurchaseBill;
