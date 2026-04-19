import mongoose from 'mongoose';

const offlineSaleItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
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
      min: 1,
    },
    salePrice: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    costPrice: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    totalSale: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    totalCost: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    profit: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    _id: false,
  }
);

const offlineSaleSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: false,
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
    rowType: {
      type: String,
      enum: ['product_sale', 'service', 'misc', 'day_status'],
      default: 'product_sale',
    },
    source: {
      type: String,
      enum: ['manual', 'history_import'],
      default: 'manual',
    },
    dayStatus: {
      type: String,
      enum: ['', 'No Sale', 'Holiday', 'Sunday', 'Closed'],
      default: '',
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    saleDate: {
      type: Date,
      required: true,
    },
    quantitySold: {
      type: Number,
      required: false,
      min: 0,
      default: 0,
    },
    salePricePerItem: {
      type: Number,
      required: false,
      min: 0,
      default: 0,
    },
    totalSale: {
      type: Number,
      required: false,
      min: 0,
      default: 0,
    },
    costPricePerItem: {
      type: Number,
      required: false,
      min: 0,
      default: 0,
    },
    totalCost: {
      type: Number,
      required: false,
      min: 0,
      default: 0,
    },
    profit: {
      type: Number,
      required: false,
      default: 0,
    },
    items: {
      type: [offlineSaleItemSchema],
      default: [],
    },
    paymentMode: {
      type: String,
      enum: ['', 'Cash', 'Pending'],
      required: false,
      default: '',
    },
    paymentStatus: {
      type: String,
      enum: ['Full Payment', 'Partial Payment', 'Pending'],
      required: false,
      default: 'Full Payment',
    },
    receivedAmount: {
      type: Number,
      required: false,
      min: 0,
      default: 0,
    },
    pendingAmount: {
      type: Number,
      required: false,
      min: 0,
      default: 0,
    },
    customerName: {
      type: String,
      trim: true,
      default: '',
    },
customerPhone: {
  type: String,
  trim: true,
  default: '',
},
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const OfflineSale = mongoose.model('OfflineSale', offlineSaleSchema);

export default OfflineSale;