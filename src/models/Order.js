import mongoose from 'mongoose';

const orderSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    orderItems: [
      {
        name: { type: String, required: true },
        qty: { type: Number, required: true },
        image: { type: String, required: true },
        price: { type: Number, required: true },
        costPrice: {
          type: Number,
          required: false,
          default: 0,
        },
        variantId: {
          type: mongoose.Schema.Types.ObjectId,
          required: false,
          default: null,
        },
        variantName: {
          type: String,
          required: false,
          default: '',
        },
        variantSku: {
          type: String,
          required: false,
          default: '',
        },
        variantAttributes: {
          type: Array,
          required: false,
          default: [],
        },
        product: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
          ref: 'Product',
        },
      },
    ],
    shippingAddress: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      address: { type: String, required: true },
      city: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
    },
    paymentMethod: {
      type: String,
      required: true,
      enum: ['COD', 'JAZZCASH'], // ✅ Sirf COD and JAZZCASH allowed
      default: 'COD'
    },
     paymentResult: {
      id: { type: String },
      status: { type: String },
      update_time: { type: String },
      email_address: { type: String },
    },
    itemsPrice: {
      type: Number,
      required: true,
      default: 0.0,
    },
    taxPrice: {
      type: Number,
      required: true,
      default: 0.0,
    },
    shippingPrice: {
      type: Number,
      required: true,
      default: 0.0,
    },
    totalPrice: {
      type: Number,
      required: true,
      default: 0.0,
    },
    isPaid: {
      type: Boolean,
      required: true,
      default: false,
    },
    paidAt: {
      type: Date,
    },
    promoCode: {
  type: String,
  default: null,
},
discountAmount: {
  type: Number,
  default: 0,
},
    isDelivered: {
      type: Boolean,
      required: true,
      default: false,
    },
    isDispatched: {
      type: Boolean,
      required: true,
      default: false,
    },
    dispatchedAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    isCancelled: {
  type: Boolean,
  default: false,
},
cancelledAt: Date,
cancelledBy: {
  type: String,
  enum: ['seller', 'customer'],
  default: null,
},
cancelReason: {
  type: String,
  default: '',
  trim: true,
},
  },
  {
    timestamps: true,
  }
);

const Order = mongoose.model('Order', orderSchema);
export default Order;
