import Product from '../models/Product.js';
import Order from '../models/Order.js';
import { hasCloudinaryConfig } from '../config/cloudinary.js';
import { uploadBufferToCloudinary } from '../utils/uploadToCloudinary.js';

const DEFAULT_PRODUCT_IMAGE = '/uploads/product-placeholder.png';
const CATEGORY_DETAIL_TEMPLATES = {
  Bat: {
    description: (name) =>
      `${name} is designed for dependable stroke play with a balanced pickup, responsive blade feel, and comfortable grip for regular match and practice sessions.`,
    features: [
      'Balanced pickup for controlled shots',
      'Comfortable grip for longer sessions',
      'Durable blade profile for regular use',
      'Suitable for net practice and match play',
    ],
    specifications: [
      { name: 'Weight', value: 'Light to Medium' },
      { name: 'Willow Type', value: 'Premium Sports Willow' },
      { name: 'Grip Type', value: 'Comfort Grip' },
      { name: 'Bat Size', value: 'Standard' },
    ],
  },

  Ball: {
    description: (name) =>
      `${name} is built for reliable performance, consistent bounce, and durable day-to-day use across training sessions, casual play, and competitive matches.`,
    features: [
      'Consistent bounce and feel',
      'Durable construction for repeated use',
      'Suitable for training and match play',
      'Easy handling and control',
    ],
    specifications: [
      { name: 'Weight', value: 'Standard Match Weight' },
      { name: 'Material', value: 'Durable Composite' },
      { name: 'Type', value: 'Practice / Match Use' },
      { name: 'Color', value: 'Standard' },
    ],
  },

  Shaker: {
    description: (name) =>
      `${name} is built for convenience and durability, making it easy to mix drinks and carry during fitness routines.`,
    features: [
      'Leak-proof design',
      'Easy mixing',
      'Portable and lightweight',
      'Durable material',
    ],
    specifications: [
      { name: 'Capacity', value: '500-700ml' },
      { name: 'Material', value: 'Food-grade Plastic' },
      { name: 'Lid', value: 'Secure Lock' },
      { name: 'Usage', value: 'Gym / Fitness' },
    ],
  },

   Accessories: {
    description: (name) =>
      `${name} is a practical sports accessory designed for everyday convenience and reliable use during training or matches.`,
    features: [
      'Lightweight and portable',
      'Durable build quality',
      'Easy to use',
      'Multi-purpose usage',
    ],
    specifications: [
      { name: 'Material', value: 'Durable Material' },
      { name: 'Size', value: 'Standard' },
      { name: 'Usage', value: 'Sports Utility' },
      { name: 'Quantity', value: '1 Unit' },
    ],
  },

   Sleeves: {
    description: (name) =>
      `${name} is designed for comfort, stretch, and reliable coverage, making it a useful addition for training and outdoor sports use.`,
    features: [
      'Stretchable fit',
      'Breathable fabric',
      'Lightweight design',
      'UV protection support',
    ],
    specifications: [
      { name: 'Size', value: 'Free Size' },
      { name: 'Fabric', value: 'Elastic Performance Fabric' },
      { name: 'Usage', value: 'Sports / Outdoor' },
      { name: 'Fit', value: 'Compression Fit' },
    ],
  },

    Gloves: {
    description: (name) =>
      `${name} offers a secure fit, comfortable feel, and dependable protection for players who need grip, flexibility, and all-session comfort.`,
    features: [
      'Secure fit with flexible feel',
      'Comfortable inner lining',
      'Reliable grip support',
      'Suitable for extended sessions',
    ],
    specifications: [
      { name: 'Size', value: 'Standard' },
      { name: 'Material', value: 'Synthetic Blend' },
      { name: 'Padding', value: 'Comfort Padding' },
      { name: 'Usage', value: 'Multi-sport' },
    ],
  },

  Footwear: {
    description: (name) =>
      `${name} is designed for comfort, grip, and support, making it ideal for sports activities, training sessions, and everyday active use.`,
    features: [
      'Comfortable cushioning for long wear',
      'Anti-slip sole for better grip',
      'Breathable design',
      'Suitable for indoor and outdoor sports',
    ],
    specifications: [
      { name: 'Size', value: 'Multiple Sizes Available' },
      { name: 'Material', value: 'Synthetic / Mesh' },
      { name: 'Sole Type', value: 'Rubber Grip Sole' },
      { name: 'Closure Type', value: 'Lace / Slip-on' },
    ],
  },

  Hockey: {
    description: (name) =>
      `${name} is built for control, durability, and consistent performance, making it suitable for training and competitive hockey play.`,
    features: [
      'Strong build for powerful hits',
      'Balanced handling',
      'Durable material for long-term use',
      'Suitable for practice and matches',
    ],
    specifications: [
      { name: 'Material', value: 'Composite / Wood' },
      { name: 'Size', value: 'Standard' },
      { name: 'Weight', value: 'Balanced' },
      { name: 'Usage', value: 'Training / Match' },
    ],
  },

  Football: {
    description: (name) =>
      `${name} is designed for consistent performance, durability, and reliable control during practice sessions and competitive matches.`,
    features: [
      'Durable outer material',
      'Consistent shape retention',
      'Good grip and control',
      'Suitable for all ground types',
    ],
    specifications: [
      { name: 'Size', value: 'Standard (3/4/5)' },
      { name: 'Material', value: 'PU / PVC' },
      { name: 'Bladder', value: 'Butyl / Latex' },
      { name: 'Usage', value: 'Match / Training' },
    ],
  },

  Basketball: {
    description: (name) =>
      `${name} provides excellent grip, bounce, and durability for indoor and outdoor basketball play.`,
    features: [
      'High grip surface',
      'Consistent bounce',
      'Durable for rough courts',
      'Ideal for practice and matches',
    ],
    specifications: [
      { name: 'Size', value: 'Standard (6/7)' },
      { name: 'Material', value: 'Rubber / Composite' },
      { name: 'Surface', value: 'Indoor / Outdoor' },
      { name: 'Weight', value: 'Standard' },
    ],
  },

  Volleyball: {
    description: (name) =>
      `${name} is crafted for soft touch, accurate flight, and consistent performance during volleyball matches and training.`,
    features: [
      'Soft touch feel',
      'Accurate flight control',
      'Durable stitching',
      'Lightweight design',
    ],
    specifications: [
      { name: 'Size', value: 'Standard' },
      { name: 'Material', value: 'Synthetic Leather' },
      { name: 'Weight', value: 'Lightweight' },
      { name: 'Usage', value: 'Indoor / Outdoor' },
    ],
  },

  Indoor: {
    description: (name) =>
      `${name} is suitable for indoor gameplay, offering durability, smooth performance, and enjoyable play experience.`,
    features: [
      'Designed for indoor use',
      'Smooth gameplay experience',
      'Durable materials',
      'Easy to handle',
    ],
    specifications: [
      { name: 'Material', value: 'Indoor-safe Material' },
      { name: 'Usage', value: 'Indoor Play' },
      { name: 'Size', value: 'Standard' },
      { name: 'Players', value: 'Multi-player' },
    ],
  },

  Outdoor: {
    description: (name) =>
      `${name} is built for outdoor conditions with strong durability, weather resistance, and long-lasting performance.`,
    features: [
      'Weather-resistant build',
      'Durable for rough surfaces',
      'Suitable for outdoor play',
      'Long-lasting performance',
    ],
    specifications: [
      { name: 'Material', value: 'Heavy-duty Material' },
      { name: 'Usage', value: 'Outdoor' },
      { name: 'Durability', value: 'High' },
      { name: 'Size', value: 'Standard' },
    ],
  },

  Ludo: {
    description: (name) =>
      `${name} is a fun indoor board game designed for family entertainment and casual gameplay.`,
    features: [
      'Easy to play',
      'Family-friendly game',
      'Compact design',
      'Reusable board and pieces',
    ],
    specifications: [
      { name: 'Players', value: '2-4' },
      { name: 'Material', value: 'Board / Plastic' },
      { name: 'Size', value: 'Standard' },
      { name: 'Type', value: 'Board Game' },
    ],
  },

  Snooker: {
    description: (name) =>
      `${name} is designed for precision play, smooth control, and professional snooker performance.`,
    features: [
      'Smooth cue control',
      'Accurate shots',
      'Durable build',
      'Professional feel',
    ],
    specifications: [
      { name: 'Material', value: 'Wood / Composite' },
      { name: 'Length', value: 'Standard' },
      { name: 'Usage', value: 'Indoor' },
      { name: 'Type', value: 'Cue / Accessory' },
    ],
  },

  CarromBoard: {
    description: (name) =>
      `${name} provides smooth surface play and durable construction for enjoyable carrom matches.`,
    features: [
      'Smooth playing surface',
      'Durable frame',
      'Accurate rebound',
      'Suitable for all skill levels',
    ],
    specifications: [
      { name: 'Material', value: 'Wood' },
      { name: 'Size', value: 'Standard' },
      { name: 'Surface Finish', value: 'Polished' },
      { name: 'Usage', value: 'Indoor' },
    ],
  },

  Chess: {
    description: (name) =>
      `${name} is a classic strategy board game designed for mental challenge and skill development.`,
    features: [
      'Enhances strategic thinking',
      'Durable pieces',
      'Portable design',
      'Suitable for all ages',
    ],
    specifications: [
      { name: 'Material', value: 'Plastic / Wood' },
      { name: 'Players', value: '2' },
      { name: 'Board Size', value: 'Standard' },
      { name: 'Type', value: 'Strategy Game' },
    ],
  },

  Racket: {
    description: (name) =>
      `${name} is designed for precision, control, and powerful shots across various racket sports.`,
    features: [
      'Lightweight design',
      'Strong frame',
      'Comfortable grip',
      'Suitable for training and matches',
    ],
    specifications: [
      { name: 'Material', value: 'Graphite / Aluminum' },
      { name: 'Weight', value: 'Lightweight' },
      { name: 'Grip Size', value: 'Standard' },
      { name: 'Usage', value: 'Match / Practice' },
    ],
  },

  Shuttlecock: {
    description: (name) =>
      `${name} ensures stable flight, durability, and consistent performance for badminton games.`,
    features: [
      'Stable flight path',
      'Durable feathers / nylon',
      'Consistent speed',
      'Suitable for indoor play',
    ],
    specifications: [
      { name: 'Material', value: 'Feather / Nylon' },
      { name: 'Speed', value: 'Medium' },
      { name: 'Quantity', value: 'Pack' },
      { name: 'Usage', value: 'Badminton' },
    ],
  },

  Bag: {
    description: (name) =>
      `${name} is designed for convenient storage and easy transport of sports gear and daily essentials.`,
    features: [
      'Spacious compartments',
      'Durable material',
      'Easy to carry',
      'Lightweight design',
    ],
    specifications: [
      { name: 'Material', value: 'Polyester / Nylon' },
      { name: 'Capacity', value: 'Medium to Large' },
      { name: 'Straps', value: 'Adjustable' },
      { name: 'Usage', value: 'Sports / Travel' },
    ],
  },

  Award: {
    description: (name) =>
      `${name} is designed to recognize achievement and celebrate success with a premium and presentable finish.`,
    features: [
      'Premium look and finish',
      'Durable build quality',
      'Ideal for ceremonies and events',
      'Attractive design',
    ],
    specifications: [
      { name: 'Material', value: 'Metal / Plastic / Wood' },
      { name: 'Size', value: 'Standard' },
      { name: 'Finish', value: 'Glossy / Matte' },
      { name: 'Usage', value: 'Awards / Recognition' },
    ],
  },

  Bottomwear: {
    description: (name) =>
      `${name} is designed for comfort, flexibility, and everyday sports or casual wear.`,
    features: [
      'Comfortable fabric',
      'Flexible fit',
      'Breathable design',
      'Suitable for sports and casual use',
    ],
    specifications: [
      { name: 'Size', value: 'Multiple Sizes' },
      { name: 'Fabric', value: 'Cotton / Polyester' },
      { name: 'Fit Type', value: 'Regular / Slim' },
      { name: 'Usage', value: 'Sports / Casual' },
    ],
  },

  Other: {
    description: (name) =>
      `${name} is a reliable product suitable for general sports use, offering durability and ease of use in daily routines.`,
    features: [
      'General-purpose use',
      'Durable construction',
      'Easy handling',
      'Suitable for all users',
    ],
    specifications: [
      { name: 'Material', value: 'Standard Material' },
      { name: 'Usage', value: 'General' },
      { name: 'Size', value: 'Standard' },
      { name: 'Color', value: 'Assorted' },
    ],
  },
};

const normalizeImageValue = (filePath = '') => {
  const normalizedPath = String(filePath).replace(/\\/g, '/').trim();

  if (!normalizedPath) {
    return '';
  }

  if (/^https?:\/\//i.test(normalizedPath)) {
    return normalizedPath;
  }

  const uploadsIndex = normalizedPath.toLowerCase().lastIndexOf('/uploads/');

  if (uploadsIndex >= 0) {
    return normalizedPath.slice(uploadsIndex);
  }

  const fileName = normalizedPath.split('/').filter(Boolean).pop();
  return fileName ? `/uploads/${fileName}` : DEFAULT_PRODUCT_IMAGE;
};

const getUploadedFilesByField = (req, fieldName = 'images') => {
  if (!req?.files) {
    return [];
  }

  if (Array.isArray(req.files)) {
    return req.files;
  }

  return Array.isArray(req.files[fieldName]) ? req.files[fieldName] : [];
};

const uploadIncomingFiles = async (req, fieldName = 'images') => {
  const files = getUploadedFilesByField(req, fieldName);

  if (files.length) {
    if (!hasCloudinaryConfig()) {
      console.error('Product upload blocked: Cloudinary is not configured for permanent image storage');
      const error = new Error(
        'Cloudinary is not configured. Please add Cloudinary credentials for permanent product image storage.'
      );
      error.statusCode = 500;
      throw error;
    }

    const uploadedImages = await Promise.all(files.map((file) => uploadBufferToCloudinary(file)));

    return uploadedImages.filter(Boolean);
  }

  return [];
};

const getIncomingImages = (req) => {
  const bodyImages = [];

  if (Array.isArray(req.body.images)) {
    bodyImages.push(...req.body.images);
  }

  if (typeof req.body.images === 'string' && req.body.images.trim()) {
    try {
      const parsed = JSON.parse(req.body.images);
      if (Array.isArray(parsed)) {
        bodyImages.push(...parsed);
      }
    } catch {
      bodyImages.push(
        ...req.body.images
        .split(',')
        .map((image) => image.trim())
        .filter(Boolean)
      );
    }
  }

  if (typeof req.body.image === 'string' && req.body.image.trim()) {
    bodyImages.push(req.body.image.trim());
  }

  return bodyImages.filter(Boolean).map(normalizeImageValue);
};

const getIncomingSpecifications = (req) => {
  if (Array.isArray(req.body.specifications)) {
    return req.body.specifications
      .filter((item) => item?.name && item?.value)
      .map((item) => ({
        name: item.name.trim(),
        value: item.value.trim(),
      }));
  }

  if (typeof req.body.specifications === 'string' && req.body.specifications.trim()) {
    try {
      const parsed = JSON.parse(req.body.specifications);

      if (Array.isArray(parsed)) {
        return parsed
          .filter((item) => item?.name && item?.value)
          .map((item) => ({
            name: item.name.trim(),
            value: item.value.trim(),
          }));
      }
    } catch {
      return [];
    }
  }

  return [];
};

const getIncomingFeatures = (req) => {
  if (Array.isArray(req.body.features)) {
    return req.body.features
      .map((feature) => String(feature || '').trim())
      .filter(Boolean);
  }

  if (typeof req.body.features === 'string' && req.body.features.trim()) {
    try {
      const parsed = JSON.parse(req.body.features);

      if (Array.isArray(parsed)) {
        return parsed
          .map((feature) => String(feature || '').trim())
          .filter(Boolean);
      }
    } catch {
      return req.body.features
        .split(',')
        .map((feature) => feature.trim())
        .filter(Boolean);
    }
  }

  return [];
};

const parseJsonArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== 'string' || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const toBoolean = (value) =>
  value === true || value === 'true' || value === 'on' || value === 1 || value === '1';

const getVariantAttributeList = (value) => {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item?.name && item?.value)
      .map((item) => ({
        name: String(item.name).trim(),
        value: String(item.value).trim(),
      }));
  }

  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(([, attributeValue]) => attributeValue !== undefined && attributeValue !== null)
      .map(([name, attributeValue]) => ({
        name: String(name).trim(),
        value: String(attributeValue).trim(),
      }))
      .filter((item) => item.name && item.value);
  }

  return [];
};

const normalizeVariantImage = (value) => {
  const normalized = normalizeImageValue(value);
  return normalized || '';
};

const getIncomingVariants = (req, uploadedVariantImages = []) => {
  const rawVariants = req.body.variants ?? req.body.variantOptions ?? req.body.productVariants;
  const parsedVariants = parseJsonArray(rawVariants);

  return parsedVariants
    .map((variant) => {
      const variantName = String(
        variant?.name || variant?.label || variant?.title || variant?.variantName || ''
      ).trim();

      if (!variantName) {
        return null;
      }

      const price = Number(variant?.price);
      const costPrice = Number(variant?.costPrice ?? variant?.cost);
      const countInStock = Number(variant?.countInStock ?? variant?.stock ?? variant?.quantity);
      const imageFileIndex = Number(variant?.imageFileIndex);
      const mappedUploadedImage =
        Number.isInteger(imageFileIndex) && imageFileIndex >= 0
          ? uploadedVariantImages[imageFileIndex]
          : '';
      const image = mappedUploadedImage || normalizeVariantImage(variant?.image || variant?.img || '');

      if (!Number.isFinite(price) || !Number.isFinite(countInStock)) {
        const error = new Error(`Variant "${variantName}" requires both price and stock`);
        error.statusCode = 400;
        throw error;
      }

      return {
        name: variantName,
        sku: String(variant?.sku || '').trim(),
        price,
        costPrice: Number.isFinite(costPrice) ? costPrice : 0,
        countInStock,
        image,
        isDefault: toBoolean(variant?.isDefault),
        attributes: getVariantAttributeList(
          variant?.attributes ?? variant?.options ?? variant?.values ?? []
        ),
      };
    })
    .filter(Boolean);
};

const getPrimaryVariant = (variants = []) => {
  if (!Array.isArray(variants) || !variants.length) {
    return null;
  }

  return variants.find((variant) => variant.isDefault) || variants[0];
};

const getAggregateProductStats = ({ variants = [], price, costPrice, countInStock, images = [] }) => {
  if (!variants.length) {
    return {
      productType: 'single',
      price: Number(price) || 0,
      costPrice: Number(costPrice) || 0,
      countInStock: Number(countInStock) || 0,
      image: images[0] || DEFAULT_PRODUCT_IMAGE,
    };
  }

  const primaryVariant = getPrimaryVariant(variants);
  const activeVariants = variants.filter((variant) => variant !== null);
  const totalStock = activeVariants.reduce(
    (sum, variant) => sum + Number(variant.countInStock || 0),
    0
  );

  return {
    productType: 'variable',
    price: Number(primaryVariant?.price ?? price ?? 0) || 0,
    costPrice: Number(primaryVariant?.costPrice ?? costPrice ?? 0) || 0,
    countInStock: totalStock,
    image: primaryVariant?.image || images[0] || DEFAULT_PRODUCT_IMAGE,
  };
};

const normalizeGeneratedText = (value = '') =>
  String(value || '').trim().replace(/\s+/g, ' ');

const getCategoryTemplate = (category = '') =>
  CATEGORY_DETAIL_TEMPLATES[normalizeGeneratedText(category)] ||
  CATEGORY_DETAIL_TEMPLATES.Other;

export const generateProductDetails = async (req, res) => {
  const name = normalizeGeneratedText(req.body.name);
  const category = normalizeGeneratedText(req.body.category);

  if (!name || !category) {
    res.status(400);
    throw new Error('Product name and category are required');
  }

  const template = getCategoryTemplate(category);

  res.json({
    description: template.description(name),
    features: template.features,
    specifications: template.specifications,
  });
};

export const getProducts = async (req, res) => {
  const hasPaginationQuery =
    req.query.page !== undefined ||
    req.query.limit !== undefined ||
    req.query.pageNumber !== undefined ||
    req.query.pageSize !== undefined;

  const page = Math.max(
    1,
    Number(req.query.page || req.query.pageNumber || 1)
  );
  const pageSize = hasPaginationQuery
    ? Math.max(1, Number(req.query.limit || req.query.pageSize || 9))
    : null;

  const keyword = req.query.keyword
    ? {
        name: {
          $regex: req.query.keyword,
          $options: 'i',
        },
      }
    : {};

  const count = await Product.countDocuments(keyword);
  let productQuery = Product.find(keyword).sort({ createdAt: -1 });

  if (pageSize) {
    productQuery = productQuery.limit(pageSize).skip(pageSize * (page - 1));
  }

  const products = await productQuery;

  res.json({
    products,
    page,
    pages: pageSize ? Math.max(1, Math.ceil(count / pageSize)) : 1,
    limit: pageSize || count,
    totalProducts: count,
  });
};

export const getFeaturedProducts = async (req, res) => {
  const products = await Product.find({ isFeatured: true }).sort({ createdAt: -1 });
  res.json(products);
};

export const getProductById = async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  res.json(product);
};

export const createProduct = async (req, res) => {
  const { name, price, costPrice, brand, category, countInStock, description, codAvailable, isFeatured } = req.body;
  const uploadedVariantImages = await uploadIncomingFiles(req, 'variantImages');
  const incomingVariants = getIncomingVariants(req, uploadedVariantImages);

  if (!name || !brand || !category || !description) {
    res.status(400);
    throw new Error('Name, brand, category, and description are required');
  }

  if (!incomingVariants.length && (price === undefined || price === null || price === '')) {
    res.status(400);
    throw new Error('Price is required for single products');
  }

  const uploadedImages = await uploadIncomingFiles(req, 'images');
  const images = uploadedImages.length ? uploadedImages : getIncomingImages(req);
  const specifications = getIncomingSpecifications(req);
  const features = getIncomingFeatures(req);
  const aggregateStats = getAggregateProductStats({
    variants: incomingVariants,
    price,
    costPrice,
    countInStock,
    images,
  });

  if (!images.length) {
    res.status(400);
    throw new Error('At least one product image is required');
  }

  const product = await Product.create({
    name: name.trim(),
    price: aggregateStats.price,
    costPrice: aggregateStats.costPrice,
    user: req.user._id,
    image: aggregateStats.image,
    images,
    brand: brand.trim(),
    category: category.trim(),
    productType: aggregateStats.productType,
    isFeatured: toBoolean(isFeatured),
    isNewArrival: true,
    variants: incomingVariants,
    countInStock: aggregateStats.countInStock,
    codAvailable: codAvailable !== undefined ? toBoolean(codAvailable) : true,
    features,
    specifications,
    numReviews: 0,
    description: description.trim(),
  });

  res.status(201).json(product);
};

export const updateProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  const uploadedImages = await uploadIncomingFiles(req, 'images');
  const uploadedVariantImages = await uploadIncomingFiles(req, 'variantImages');
  const incomingImages = uploadedImages.length ? uploadedImages : getIncomingImages(req);
  const featuresProvided = req.body.features !== undefined;
  const incomingFeatures = getIncomingFeatures(req);
  const specificationsProvided = req.body.specifications !== undefined;
  const incomingSpecifications = getIncomingSpecifications(req);
  const variantsProvided = req.body.variants !== undefined || req.body.variantOptions !== undefined || req.body.productVariants !== undefined;
  const incomingVariants = variantsProvided
    ? getIncomingVariants(req, uploadedVariantImages)
    : product.variants;
  const nextImages = incomingImages.length ? incomingImages : product.images;
  const aggregateStats = getAggregateProductStats({
    variants: incomingVariants,
    price: req.body.price !== undefined ? Number(req.body.price) : product.price,
    costPrice:
      req.body.costPrice !== undefined ? Number(req.body.costPrice) : product.costPrice,
    countInStock:
      req.body.countInStock !== undefined ? Number(req.body.countInStock) : product.countInStock,
    images: nextImages,
  });

  product.name = req.body.name?.trim() || product.name;
  product.price =
    aggregateStats.price;
  product.costPrice =
    aggregateStats.costPrice;
  product.description = req.body.description?.trim() || product.description;
  product.brand = req.body.brand?.trim() || product.brand;
  product.category = req.body.category?.trim() || product.category;
  product.productType = aggregateStats.productType;
  if (req.body.isFeatured !== undefined) {
    product.isFeatured = toBoolean(req.body.isFeatured);
  }
  product.variants = incomingVariants;
  product.countInStock = aggregateStats.countInStock;
  product.codAvailable =
    req.body.codAvailable !== undefined ? toBoolean(req.body.codAvailable) : product.codAvailable;
  product.features = featuresProvided ? incomingFeatures : product.features;
  product.specifications = specificationsProvided
    ? incomingSpecifications
    : product.specifications;
  product.images = nextImages;
  product.image = aggregateStats.image;

  const updatedProduct = await product.save();
  res.json(updatedProduct);
};

export const deleteProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  await Product.deleteOne({ _id: product._id });
  res.json({ message: 'Product removed' });
};




// product review controllers
// @desc    Create product review
// @route   POST /api/products/:id/reviews
// @access  Private
export const createProductReview = async (req, res) => {
  const { rating, comment } = req.body;

   // 🔥 STEP 1: check purchase
  const hasPurchased = await Order.findOne({
    user: req.user._id,
    isPaid: true,
    isDelivered: true,
    "orderItems.product": req.params.id,
  });


  if (!hasPurchased) {
    res.status(403);
    throw new Error("You can only review products you have purchased");
  }

  const product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  // ✅ check already reviewed
  const alreadyReviewed = product.reviews.find(
    (r) => r.user.toString() === req.user._id.toString()
  );

  if (alreadyReviewed) {
    res.status(400);
    throw new Error('Product already reviewed');
  }

  // ✅ define review (simple object)
  const review = {
    user: req.user._id,
    name: req.user.name,
    rating: Number(rating),
    comment,
  };

  // ✅ push into product
  product.reviews.push(review);

  // ✅ update stats
  product.numReviews = product.reviews.length;

  product.rating = Number((product.reviews.reduce((acc, item) => item.rating + acc, 0) /
    product.reviews.length).toFixed(1));

  await product.save();

  res.status(201).json({ message: 'Review added successfully' });
};


// @desc    Delete review
// @route   DELETE /api/products/:id/reviews/:reviewId
// @access  Private
export const deleteProductReview = async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  const review = product.reviews.find(
    (r) => r._id.toString() === req.params.reviewId
  );

  if (!review) {
    res.status(404);
    throw new Error('Review not found');
  }

  // owner ya admin
  if (
    review.user.toString() !== req.user._id.toString() &&
    !req.user.isAdmin
  ) {
    res.status(401);
    throw new Error('Not authorized');
  }

  product.reviews = product.reviews.filter(
    (r) => r._id.toString() !== req.params.reviewId
  );

  // update stats
  product.numReviews = product.reviews.length;

  product.rating =
    product.reviews.length === 0
      ? 0
      : product.reviews.reduce((acc, item) => item.rating + acc, 0) /
        product.reviews.length;

  await product.save();

  res.json({ message: 'Review deleted' });
};


// @desc    Update review
// @route   PUT /api/products/:id/reviews/:reviewId
export const updateProductReview = async (req, res) => {
  const { rating, comment } = req.body;

  const product = await Product.findById(req.params.id);

  const review = product.reviews.find(
    (r) => r._id.toString() === req.params.reviewId
  );

  if (!review) {
    res.status(404);
    throw new Error('Review not found');
  }

  if (review.user.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error('Not authorized');
  }

  review.rating = rating;
  review.comment = comment;

  product.rating =
    product.reviews.reduce((acc, item) => item.rating + acc, 0) /
    product.reviews.length;

  await product.save();

  res.json({ message: 'Review updated' });
};


// @desc    Get latest 5-star reviews across all products
// @route   GET /api/products/top-reviews
// @access  Public
export const getTopReviews = async (req, res) => {
  const limit = Number(req.query.limit) || 5;

  // Saare products fetch karo jo 5-star reviews hain
  const products = await Product.find(
    { 'reviews.rating': 5 },
    { name: 1, reviews: 1, images: 1, image: 1 }
  );

  // Saare 5-star reviews flat array mein nikalo
  const allFiveStarReviews = [];

  for (const product of products) {
    for (const review of product.reviews) {
      if (review.rating === 5) {
        allFiveStarReviews.push({
          _id: review._id,
          name: review.name,
          rating: review.rating,
          comment: review.comment,
          createdAt: review.createdAt,
          productName: product.name,
          productImage: product.images?.[0] || product.image || null,
        });
      }
    }
  }

  // Latest pehle sort karo
  allFiveStarReviews.sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  // Limit apply karo
  const topReviews = allFiveStarReviews.slice(0, limit);

  res.json(topReviews);
};