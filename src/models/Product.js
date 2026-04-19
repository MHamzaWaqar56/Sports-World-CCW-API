import mongoose from 'mongoose';


const reviewSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    name: {
      type: String,
      required: true,
    },
    rating: {
    type: Number,
    required: true,
    min: 0,
    max: 5,
    set: (val) => Number(val.toFixed(1)),
   },
    comment: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);


const specificationSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    value: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    _id: false,
  }
);

const variantAttributeSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    value: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    _id: false,
  }
);

const productVariantSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    sku: {
      type: String,
      default: '',
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    costPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    countInStock: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    image: {
      type: String,
      default: '',
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    attributes: {
      type: [variantAttributeSchema],
      default: [],
    },
  },
  {
    timestamps: false,
  }
);

const productSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    name: {
      type: String,
      required: true,
    },
    image: {
      type: String,
      required: true,
    },
    images: {
      type: [String],
      required: false,
    },
    brand: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    productType: {
      type: String,
      enum: ['single', 'variable'],
      default: 'single',
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isNewArrival: {
      type: Boolean,
      default: false,
    },
    features: {
      type: [String],
      default: [],
    },
    variants: {
      type: [productVariantSchema],
      default: [],
    },
    specifications: {
      type: [specificationSchema],
      default: [],
    },
    reviews: [reviewSchema],
    rating: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 5,
      set: (val) => Number(val.toFixed(1)),
    },
    numReviews: {
      type: Number,
      required: true,
      default: 0,
    },
    price: {
      type: Number,
      required: true,
      default: 0,
    },
    costPrice: {
      type: Number,
      required: false,
      default: 0,
      min: 0,
    },
    countInStock: {
      type: Number,
      required: true,
      default: 0,
    },
    codAvailable: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Product = mongoose.model('Product', productSchema);
export default Product;
export { reviewSchema };
