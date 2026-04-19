import multer from 'multer';
import XLSX from 'xlsx';
import Product from '../models/Product.js';
import OfflineSale from '../models/OfflineSale.js';

const DEFAULT_PRODUCT_IMAGE = '/uploads/product-placeholder.png';
const DEFAULT_PRODUCT_BRAND = 'Sports World';
const OFFLINE_PAYMENT_MODES = ['Cash', 'Online', 'Pending'];
const PRODUCT_NAME_ALIASES = {
  'gloves regular': 'Gloves Regular',
  'gloves perium': 'Gloves Premium',
  'sw bat special edtion': 'SW Bat Special Edition',
  'jd bat legend edition': 'JD Bat Legend Edition',
  'sw bat legend': 'SW Bat Legend Edition',
  'cock (50)': 'Cock (50)',
};

const sheetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const allowedMimeTypes = new Set([
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv',
      'text/plain',
    ]);
    const lowerName = String(file.originalname || '').toLowerCase();

    if (
      allowedMimeTypes.has(file.mimetype) ||
      lowerName.endsWith('.xlsx') ||
      lowerName.endsWith('.csv')
    ) {
      cb(null, true);
      return;
    }

    cb(new Error('Only .xlsx and .csv files are allowed'));
  },
});

const escapeRegex = (value = '') =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toTrimmedString = (value) => String(value ?? '').trim();

const normalizeLookupName = (value = '') =>
  toTrimmedString(value).replace(/\s+/g, ' ').toLowerCase();

const resolveAliasedProductName = (value = '') => {
  const normalizedValue = normalizeLookupName(value);
  return PRODUCT_NAME_ALIASES[normalizedValue] || toTrimmedString(value);
};

const buildLooseTokenRegex = (value = '') =>
  normalizeLookupName(value)
    .split(' ')
    .filter(Boolean)
    .map(escapeRegex)
    .join('.*');

const toOptionalNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
};

const parseFeatures = (value) =>
  toTrimmedString(value)
    .split(/\r?\n|,|;/)
    .map((item) => item.trim())
    .filter(Boolean);

const getRowValue = (row, aliases) => {
  const normalizedEntries = Object.entries(row).map(([key, value]) => [
    key.toLowerCase().trim(),
    value,
  ]);

  for (const alias of aliases) {
    const match = normalizedEntries.find(([key]) => key === alias);
    if (match) {
      return match[1];
    }
  }

  return '';
};

const parseSheetRows = (buffer) => {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    return [];
  }

  return XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
    defval: '',
    raw: false,
  });
};

const isBlankRow = (row = {}) =>
  Object.values(row).every((value) => !toTrimmedString(value));

const normalizeSaleDateInput = (value) => {
  const dateValue = new Date(value);

  if (Number.isNaN(dateValue.getTime())) {
    return null;
  }

  return dateValue;
};

const normalizePaymentMode = (value, { strict = false } = {}) => {
  const normalizedValue = normalizeLookupName(value);
  if (!normalizedValue) {
    return null;
  }

  if (normalizedValue === 'cash') {
    return 'Cash';
  }

  if (normalizedValue === 'pending') {
    return 'Pending';
  }

  if (
    normalizedValue === 'online' ||
    (!strict && normalizedValue === 'upi') ||
    (!strict && normalizedValue === 'online/upi')
  ) {
    return strict ? 'Online' : normalizedValue === 'online' ? 'Online' : 'Online/UPI';
  }

  return null;
};

const normalizeVariantAttributes = (value) => {
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

const resolveProductVariant = (product, item = {}) => {
  const explicitVariantId = String(item.variantId || '').trim();
  const explicitVariantSku = String(item.variantSku || '').trim().toLowerCase();
  const explicitVariantName = String(item.variantName || '').trim().toLowerCase();
  const hasExplicitVariantSelector = Boolean(
    explicitVariantId || explicitVariantSku || explicitVariantName
  );

  if (!Array.isArray(product.variants) || !product.variants.length) {
    return null;
  }

  if (explicitVariantId) {
    const byId = product.variants.id(explicitVariantId);
    if (byId) {
      return byId;
    }
  }

  if (explicitVariantSku) {
    const bySku = product.variants.find(
      (variant) => String(variant.sku || '').trim().toLowerCase() === explicitVariantSku
    );

    if (bySku) {
      return bySku;
    }
  }

  if (explicitVariantName) {
    const byName = product.variants.find(
      (variant) => String(variant.name || '').trim().toLowerCase() === explicitVariantName
    );

    if (byName) {
      return byName;
    }
  }

  if (hasExplicitVariantSelector) {
    const error = new Error(`Variant not found for ${product.name}`);
    error.statusCode = 404;
    throw error;
  }

  return product.variants.find((variant) => variant.isDefault) || product.variants[0];
};

const recalculateProductStock = (product) => {
  if (!product) {
    return 0;
  }

  if (Array.isArray(product.variants) && product.variants.length) {
    product.countInStock = product.variants.reduce(
      (sum, variant) => sum + Number(variant.countInStock || 0),
      0
    );
    return product.countInStock;
  }

  product.countInStock = Number(product.countInStock || 0);
  return product.countInStock;
};

const applyProductStockChange = async (productId, quantity, item = {}, direction = 1) => {
  const product = await Product.findById(productId);

  if (!product) {
    const error = new Error(`Product not found for ${item.productName || productId}`);
    error.statusCode = 404;
    throw error;
  }

  const delta = Number(quantity || 0) * direction;
  const matchedVariant = resolveProductVariant(product, item);

  if (matchedVariant) {
    const nextStock = Number(matchedVariant.countInStock || 0) + delta;

    if (nextStock < 0) {
      const error = new Error(`Cannot reduce stock below zero for ${product.name} - ${matchedVariant.name}`);
      error.statusCode = 400;
      throw error;
    }

    matchedVariant.countInStock = nextStock;
  } else {
    const nextStock = Number(product.countInStock || 0) + delta;

    if (nextStock < 0) {
      const error = new Error(`Cannot reduce stock below zero for ${product.name}`);
      error.statusCode = 400;
      throw error;
    }

    product.countInStock = nextStock;
  }

  recalculateProductStock(product);
  await product.save();
  return product;
};

const derivePaymentDetails = ({ totalSale, paymentMode, pendingAmount, customerName }) => {
  const normalizedCustomerName = toTrimmedString(customerName);
  const normalizedPendingAmount = Number(pendingAmount ?? 0);

  if (paymentMode === 'Pending') {
    if (!Number.isFinite(normalizedPendingAmount) || normalizedPendingAmount <= 0) {
      throw new Error('Pending amount must be greater than 0');
    }

    if (normalizedPendingAmount > totalSale) {
      throw new Error('Pending Amount cannot be greater than Total Sale');
    }

    if (!normalizedCustomerName) {
      throw new Error('Customer name is required when payment is Pending');
    }

    return {
      receivedAmount: totalSale - normalizedPendingAmount,
      pendingAmount: normalizedPendingAmount,
      paymentStatus: 'Pending',
      customerName: normalizedCustomerName,
    };
  }

  return {
    receivedAmount: totalSale,
    pendingAmount: 0,
    paymentStatus: 'Full Payment',
    customerName: normalizedCustomerName,
  };
};

const getClosestProductNames = async (productName) => {
  const normalizedName = normalizeLookupName(resolveAliasedProductName(productName));

  if (!normalizedName) {
    return [];
  }

  const looseRegex = buildLooseTokenRegex(normalizedName);
  const firstToken = normalizedName.split(' ').find(Boolean);
  const regexOptions = [];

  if (looseRegex) {
    regexOptions.push({ name: { $regex: looseRegex, $options: 'i' } });
  }

  if (firstToken) {
    regexOptions.push({ name: { $regex: escapeRegex(firstToken), $options: 'i' } });
  }

  if (!regexOptions.length) {
    return [];
  }

  const candidates = await Product.find({ $or: regexOptions })
    .select('name')
    .limit(5);

  return candidates.map((product) => product.name);
};

const findProductByFlexibleName = async (productName) => {
  const normalizedName = normalizeLookupName(resolveAliasedProductName(productName));

  if (!normalizedName) {
    return null;
  }

  const exactProduct = await Product.findOne({
    name: { $regex: `^${escapeRegex(normalizedName)}$`, $options: 'i' },
  });

  if (exactProduct) {
    return exactProduct;
  }

  const normalizedTokens = normalizedName.split(' ').filter(Boolean);

  if (!normalizedTokens.length) {
    return null;
  }

  const candidateProducts = await Product.find({
    name: {
      $regex: normalizedTokens.map(escapeRegex).join('.*'),
      $options: 'i',
    },
  }).limit(10);

  const normalizedCandidates = candidateProducts.filter(
    (product) =>
      normalizeLookupName(product.name).includes(normalizedName) ||
      normalizedName.includes(normalizeLookupName(product.name))
  );

  if (normalizedCandidates.length === 1) {
    return normalizedCandidates[0];
  }

  return null;
};

const logUnmatchedProductName = (productName, contextLabel, closestMatches = []) => {
  console.warn(
    `[${contextLabel}] Product not found for lookup: "${toTrimmedString(productName)}"${
      closestMatches.length ? ` | Closest matches: ${closestMatches.join(', ')}` : ''
    }`
  );
};

const detectDayStatus = (productName, notes = '') => {
  const normalizedName = normalizeLookupName(productName);
  const normalizedNotes = normalizeLookupName(notes);
  const combined = `${normalizedName} ${normalizedNotes}`.trim();

  if (combined.includes('sunday')) {
    return 'Sunday';
  }

  if (combined.includes('holiday') || combined.includes('vacation')) {
    return 'Holiday';
  }

  if (combined.includes('close') || combined.includes('closed')) {
    return 'Closed';
  }

  if (combined.includes('no sale')) {
    return 'No Sale';
  }

  return '';
};

const detectServiceRowType = (productName = '') => {
  const normalizedName = normalizeLookupName(productName);
  return normalizedName.includes('repair') || normalizedName.includes('service')
    ? 'service'
    : 'misc';
};

const getDateRangeQuery = ({ date, month, from, to }) => {
  if (date) {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(`${date}T23:59:59.999Z`);

    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      return { saleDate: { $gte: start, $lte: end } };
    }
  }

  if (month) {
    const start = new Date(`${month}-01T00:00:00.000Z`);

    if (!Number.isNaN(start.getTime())) {
      const end = new Date(start);
      end.setUTCMonth(end.getUTCMonth() + 1);
      end.setUTCMilliseconds(end.getUTCMilliseconds() - 1);
      return { saleDate: { $gte: start, $lte: end } };
    }
  }

  if (from || to) {
    const range = {};

    if (from) {
      const start = new Date(`${from}T00:00:00.000Z`);
      if (!Number.isNaN(start.getTime())) {
        range.$gte = start;
      }
    }

    if (to) {
      const end = new Date(`${to}T23:59:59.999Z`);
      if (!Number.isNaN(end.getTime())) {
        range.$lte = end;
      }
    }

    if (range.$gte || range.$lte) {
      return { saleDate: range };
    }
  }

  return {};
};

const summarizeSales = (sales) =>
  sales.reduce(
    (summary, sale) => ({
      totalSale: summary.totalSale + Number(sale.totalSale || 0),
      totalCost: summary.totalCost + Number(sale.totalCost || 0),
      totalProfit: summary.totalProfit + Number(sale.profit || 0),
      totalQuantitySold: summary.totalQuantitySold + Number(sale.quantitySold || 0),
    }),
    {
      totalSale: 0,
      totalCost: 0,
      totalProfit: 0,
      totalQuantitySold: 0,
    }
  );

const normalizeOfflineSalePayload = async ({
  saleDate,
  productId,
  productName,
  variantId,
  variantSku,
  variantName,
  variantAttributes,
  quantitySold,
  salePricePerItem,
  costPricePerItem,
  pendingAmount,
  customerName,
  paymentMode,
  notes,
  source = 'manual',
  strictPaymentMode = false,
}) => {
  const normalizedSaleDate = normalizeSaleDateInput(saleDate);
  const normalizedQuantity = Number(quantitySold);
  const normalizedSalePrice = Number(salePricePerItem);
  const normalizedPaymentMode = normalizePaymentMode(paymentMode, {
    strict: strictPaymentMode,
  });

  if (!normalizedSaleDate) {
    throw new Error('Valid sale date is required');
  }

  if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
    throw new Error(`Quantity Sold must be greater than 0. Received: ${quantitySold}`);
  }

  if (!Number.isFinite(normalizedSalePrice) || normalizedSalePrice < 0) {
    throw new Error('Sale Price Per Item must be 0 or more');
  }

  if (!normalizedPaymentMode) {
    throw new Error(
      strictPaymentMode
        ? `Invalid Payment Mode: "${toTrimmedString(paymentMode)}". Use Cash, Online, or Pending`
        : `Invalid Payment Mode: "${toTrimmedString(paymentMode)}". Use Cash, Pending, or Online/UPI`
    );
  }

  let product = null;

  if (productId) {
    product = await Product.findById(productId);
  } else if (productName) {
    product = await findProductByFlexibleName(productName);
  }

  if (!product) {
    if (productName) {
      const closestMatches = await getClosestProductNames(productName);
      logUnmatchedProductName(productName, 'offline-sales', closestMatches);
      throw new Error(
        `Product not found: "${toTrimmedString(productName)}"${
          closestMatches.length ? `. Closest matches: ${closestMatches.join(', ')}` : ''
        }`
      );
    }
    throw new Error('Product not found');
  }

  const matchedVariant = resolveProductVariant(product, {
    variantId,
    variantSku,
    variantName,
  });

  const resolvedCostPrice =
    costPricePerItem !== undefined && costPricePerItem !== null && costPricePerItem !== ''
      ? Number(costPricePerItem)
      : Number(matchedVariant?.costPrice ?? product.costPrice);

  const totalSale = normalizedQuantity * normalizedSalePrice;

  if (!Number.isFinite(resolvedCostPrice) || resolvedCostPrice < 0) {
    throw new Error('Cost Price Per Item must be 0 or more');
  }

  const totalCost = normalizedQuantity * resolvedCostPrice;
  const paymentDetails = derivePaymentDetails({
    totalSale,
    paymentMode: normalizedPaymentMode,
    pendingAmount,
    customerName,
  });

  return {
    source,
    product,
    rowType: 'product_sale',
    dayStatus: '',
    productName: product.name,
    variantId: matchedVariant?._id || null,
    variantName: matchedVariant?.name || toTrimmedString(variantName),
    variantSku: matchedVariant?.sku || toTrimmedString(variantSku),
    variantAttributes: normalizeVariantAttributes(
      matchedVariant?.attributes || variantAttributes || []
    ),
    saleDate: normalizedSaleDate,
    quantitySold: normalizedQuantity,
    salePricePerItem: normalizedSalePrice,
    costPricePerItem: resolvedCostPrice,
    totalSale,
    totalCost,
    profit: totalSale - totalCost,
    paymentMode: normalizedPaymentMode,
    paymentStatus: paymentDetails.paymentStatus,
    receivedAmount: paymentDetails.receivedAmount,
    pendingAmount: paymentDetails.pendingAmount,
    customerName: paymentDetails.customerName,
    notes: toTrimmedString(notes),
  };
};

const createOfflineSaleRecord = async (normalizedSale, userId) => {
  if (normalizedSale.rowType && normalizedSale.rowType !== 'product_sale') {
    const sale = await OfflineSale.create({
      product: normalizedSale.product?._id || null,
      variantId: normalizedSale.variantId || null,
      variantName: normalizedSale.variantName || '',
      variantSku: normalizedSale.variantSku || '',
      variantAttributes: normalizedSale.variantAttributes || [],
      rowType: normalizedSale.rowType,
      source: normalizedSale.source || 'manual',
      dayStatus: normalizedSale.dayStatus || '',
      productName: normalizedSale.productName,
      saleDate: normalizedSale.saleDate,
      quantitySold: normalizedSale.quantitySold ?? 0,
      salePricePerItem: normalizedSale.salePricePerItem ?? 0,
      totalSale: normalizedSale.totalSale ?? 0,
      costPricePerItem: normalizedSale.costPricePerItem ?? 0,
      totalCost: normalizedSale.totalCost ?? 0,
      profit: normalizedSale.profit ?? 0,
      paymentMode: normalizedSale.paymentMode || '',
      paymentStatus: normalizedSale.paymentStatus || 'Full Payment',
      receivedAmount: normalizedSale.receivedAmount ?? normalizedSale.totalSale ?? 0,
      pendingAmount: normalizedSale.pendingAmount ?? 0,
      customerName: normalizedSale.customerName || '',
      notes: normalizedSale.notes,
      createdBy: userId,
    });

    return { sale, productStock: null };
  }

  if (normalizedSale.source === 'history_import') {
    const sale = await OfflineSale.create({
      product: normalizedSale.product?._id || null,
      variantId: normalizedSale.variantId || null,
      variantName: normalizedSale.variantName || '',
      variantSku: normalizedSale.variantSku || '',
      variantAttributes: normalizedSale.variantAttributes || [],
      rowType: normalizedSale.rowType || 'product_sale',
      source: 'history_import',
      dayStatus: normalizedSale.dayStatus || '',
      productName: normalizedSale.productName,
      saleDate: normalizedSale.saleDate,
      quantitySold: normalizedSale.quantitySold,
      salePricePerItem: normalizedSale.salePricePerItem,
      totalSale: normalizedSale.totalSale,
      costPricePerItem: normalizedSale.costPricePerItem,
      totalCost: normalizedSale.totalCost,
      profit: normalizedSale.profit,
      paymentMode: normalizedSale.paymentMode,
      paymentStatus: normalizedSale.paymentStatus || 'Full Payment',
      receivedAmount: normalizedSale.receivedAmount ?? normalizedSale.totalSale ?? 0,
      pendingAmount: normalizedSale.pendingAmount ?? 0,
      customerName: normalizedSale.customerName || '',
      notes: normalizedSale.notes,
      createdBy: userId,
    });

    return { sale, productStock: null };
  }

  const updatedProduct = await applyProductStockChange(
    normalizedSale.product._id,
    normalizedSale.quantitySold,
    normalizedSale,
    -1
  );

  try {
    const sale = await OfflineSale.create({
      product: updatedProduct._id,
      variantId: normalizedSale.variantId || null,
      variantName: normalizedSale.variantName || '',
      variantSku: normalizedSale.variantSku || '',
      variantAttributes: normalizedSale.variantAttributes || [],
      rowType: normalizedSale.rowType || 'product_sale',
      source: normalizedSale.source || 'manual',
      dayStatus: normalizedSale.dayStatus || '',
      productName: updatedProduct.name,
      saleDate: normalizedSale.saleDate,
      quantitySold: normalizedSale.quantitySold,
      salePricePerItem: normalizedSale.salePricePerItem,
      totalSale: normalizedSale.totalSale,
      costPricePerItem: normalizedSale.costPricePerItem,
      totalCost: normalizedSale.totalCost,
      profit: normalizedSale.profit,
      paymentMode: normalizedSale.paymentMode,
      paymentStatus: normalizedSale.paymentStatus,
      receivedAmount: normalizedSale.receivedAmount,
      pendingAmount: normalizedSale.pendingAmount,
      customerName: normalizedSale.customerName,
      notes: normalizedSale.notes,
      createdBy: userId,
    });

    return {
      sale,
      productStock: updatedProduct.countInStock,
    };
  } catch (error) {
    await applyProductStockChange(
      normalizedSale.product._id,
      normalizedSale.quantitySold,
      normalizedSale,
      1
    );
    throw error;
  }
};

const updateOfflineSaleRecord = async (existingSale, normalizedSale) => {
  if ((existingSale.source || 'manual') === 'history_import') {
    existingSale.product = normalizedSale.product?._id || null;
    existingSale.rowType = normalizedSale.rowType || existingSale.rowType || 'product_sale';
    existingSale.source = 'history_import';
    existingSale.dayStatus = normalizedSale.dayStatus || '';
    existingSale.productName = normalizedSale.productName;
    existingSale.saleDate = normalizedSale.saleDate;
    existingSale.quantitySold = normalizedSale.quantitySold;
    existingSale.salePricePerItem = normalizedSale.salePricePerItem;
    existingSale.totalSale = normalizedSale.totalSale;
    existingSale.costPricePerItem = normalizedSale.costPricePerItem;
    existingSale.totalCost = normalizedSale.totalCost;
    existingSale.profit = normalizedSale.profit;
    existingSale.paymentMode = normalizedSale.paymentMode;
    existingSale.paymentStatus = normalizedSale.paymentStatus || 'Full Payment';
    existingSale.receivedAmount = normalizedSale.receivedAmount ?? normalizedSale.totalSale ?? 0;
    existingSale.pendingAmount = normalizedSale.pendingAmount ?? 0;
    existingSale.customerName = normalizedSale.customerName || '';
    existingSale.notes = normalizedSale.notes;

    const sale = await existingSale.save();
    return { sale };
  }

  const oldProductRef = existingSale.product?._id || existingSale.product;
  const oldQuantitySold = existingSale.quantitySold;
  const oldStockContext = {
    productName: existingSale.productName,
    variantId: existingSale.variantId,
    variantSku: existingSale.variantSku,
    variantName: existingSale.variantName,
    variantAttributes: existingSale.variantAttributes,
  };
  const newStockContext = {
    productName: normalizedSale.product.name,
    variantId: normalizedSale.variantId,
    variantSku: normalizedSale.variantSku,
    variantName: normalizedSale.variantName,
    variantAttributes: normalizedSale.variantAttributes,
  };

  if (existingSale.source !== 'history_import') {
    await applyProductStockChange(oldProductRef, oldQuantitySold, oldStockContext, 1);

    try {
      await applyProductStockChange(
        normalizedSale.product._id,
        normalizedSale.quantitySold,
        newStockContext,
        -1
      );
    } catch (error) {
      await applyProductStockChange(oldProductRef, oldQuantitySold, oldStockContext, -1);
      throw error;
    }
  }

  existingSale.product = normalizedSale.product._id;
  existingSale.productName = normalizedSale.product.name;
  existingSale.variantId = normalizedSale.variantId || null;
  existingSale.variantName = normalizedSale.variantName || '';
  existingSale.variantSku = normalizedSale.variantSku || '';
  existingSale.variantAttributes = normalizedSale.variantAttributes || [];
  existingSale.saleDate = normalizedSale.saleDate;
  existingSale.quantitySold = normalizedSale.quantitySold;
  existingSale.salePricePerItem = normalizedSale.salePricePerItem;
  existingSale.totalSale = normalizedSale.totalSale;
  existingSale.costPricePerItem = normalizedSale.costPricePerItem;
  existingSale.totalCost = normalizedSale.totalCost;
  existingSale.profit = normalizedSale.profit;
  existingSale.paymentMode = normalizedSale.paymentMode;
  existingSale.paymentStatus = normalizedSale.paymentStatus;
  existingSale.receivedAmount = normalizedSale.receivedAmount;
  existingSale.pendingAmount = normalizedSale.pendingAmount;
  existingSale.customerName = normalizedSale.customerName;
  existingSale.notes = normalizedSale.notes;

  try {
    const sale = await existingSale.save();
    return { sale };
  } catch (error) {
    if (existingSale.source !== 'history_import') {
      try {
        await applyProductStockChange(
          normalizedSale.product._id,
          normalizedSale.quantitySold,
          newStockContext,
          1
        );
      } catch {
        // ignore rollback errors
      }

      try {
        await applyProductStockChange(oldProductRef, oldQuantitySold, oldStockContext, -1);
      } catch {
        // ignore rollback errors
      }
    }

    throw error;
  }
};

export const uploadStockSheetMiddleware = sheetUpload.single('stockSheet');
export const uploadOfflineSalesSheetMiddleware = sheetUpload.single('offlineSalesSheet');

export const uploadStockSheet = async (req, res) => {
  if (!req.file?.buffer) {
    res.status(400);
    throw new Error('Please upload a .xlsx or .csv stock sheet');
  }

  const rows = parseSheetRows(req.file.buffer);

  if (!rows.length) {
    res.status(400);
    throw new Error('The uploaded sheet is empty');
  }

  let created = 0;
  let updated = 0;
  let processed = 0;
  const errors = [];

  for (const [index, row] of rows.entries()) {
    const productName = toTrimmedString(
      getRowValue(row, ['product name', 'product', 'name'])
    );
    const category = toTrimmedString(getRowValue(row, ['category']));
    const openingStock = toOptionalNumber(
      getRowValue(row, ['opening stock'])
    );
    const totalSold = toOptionalNumber(
      getRowValue(row, ['total sold'])
    ) ?? 0;
    const currentStockValue = toOptionalNumber(
      getRowValue(row, ['current stock', 'stock', 'countinstock'])
    );
    const costPrice = toOptionalNumber(
      getRowValue(row, ['cost price'])
    );
    const salePrice = toOptionalNumber(
      getRowValue(row, ['sale price', 'price'])
    );
    const variantName = toTrimmedString(
      getRowValue(row, ['variant name', 'variant', 'size', 'color'])
    );
    const variantSku = toTrimmedString(getRowValue(row, ['variant sku', 'sku']));
    const variantStock = toOptionalNumber(
      getRowValue(row, ['variant stock', 'variant count', 'variant stock qty'])
    );
    const variantCostPrice = toOptionalNumber(
      getRowValue(row, ['variant cost price', 'variant cost'])
    );
    const variantSalePrice = toOptionalNumber(
      getRowValue(row, ['variant sale price', 'variant price'])
    );
    const computedCurrentStock =
      openingStock !== undefined ? openingStock - totalSold : undefined;
    const stock = currentStockValue ?? computedCurrentStock;

    if (!productName) {
      errors.push(`Row ${index + 2}: Product Name is required`);
      continue;
    }

    if (openingStock === undefined) {
      errors.push(`Row ${index + 2}: Opening Stock is required`);
      continue;
    }

    if (costPrice === undefined) {
      errors.push(`Row ${index + 2}: Cost Price is required`);
      continue;
    }

    if (salePrice === undefined) {
      errors.push(`Row ${index + 2}: Sale Price is required`);
      continue;
    }

    if (stock === undefined) {
      errors.push(`Row ${index + 2}: Current Stock could not be calculated`);
      continue;
    }

    if (stock < 0) {
      errors.push(`Row ${index + 2}: Current Stock cannot be negative`);
      continue;
    }

    const existingProduct = await findProductByFlexibleName(productName);

    if (existingProduct) {
      const effectiveVariantStock = variantStock ?? stock;

      if (variantName || variantSku) {
        const matchedVariant = Array.isArray(existingProduct.variants)
          ? existingProduct.variants.find(
              (variant) =>
                String(variant.name || '').trim().toLowerCase() === variantName.toLowerCase() ||
                String(variant.sku || '').trim().toLowerCase() === variantSku.toLowerCase()
            )
          : null;

        if (matchedVariant) {
          matchedVariant.countInStock = effectiveVariantStock;
          matchedVariant.costPrice = variantCostPrice ?? costPrice;
          matchedVariant.price = variantSalePrice ?? salePrice;
        } else {
          existingProduct.variants = existingProduct.variants || [];
          existingProduct.variants.push({
            name: variantName || variantSku || productName,
            sku: variantSku,
            price: variantSalePrice ?? salePrice,
            costPrice: variantCostPrice ?? costPrice,
            countInStock: effectiveVariantStock,
            isDefault: !(existingProduct.variants?.length),
            attributes: [],
          });
        }

        existingProduct.productType = 'variable';
        recalculateProductStock(existingProduct);
        existingProduct.costPrice = variantCostPrice ?? costPrice;
        existingProduct.price = variantSalePrice ?? salePrice;
      } else {
        existingProduct.countInStock = stock;
        existingProduct.costPrice = costPrice;
        existingProduct.price = salePrice;
      }
      if (category) {
        existingProduct.category = category;
      }
      if (!existingProduct.image) {
        existingProduct.image = DEFAULT_PRODUCT_IMAGE;
        existingProduct.images = existingProduct.images?.length
          ? existingProduct.images
          : [DEFAULT_PRODUCT_IMAGE];
      }

      await existingProduct.save();
      updated += 1;
      processed += 1;
      continue;
    }

    if (!category) {
      errors.push(`Row ${index + 2}: Category is required for new products`);
      continue;
    }

    await Product.create({
      user: req.user._id,
      name: productName,
      image: DEFAULT_PRODUCT_IMAGE,
      images: [DEFAULT_PRODUCT_IMAGE],
      brand: DEFAULT_PRODUCT_BRAND,
      category,
      description: 'Added from stock sheet import',
      features: [],
      productType: variantName || variantSku ? 'variable' : 'single',
      variants:
        variantName || variantSku
          ? [
              {
                name: variantName || variantSku || productName,
                sku: variantSku,
                price: variantSalePrice ?? salePrice,
                costPrice: variantCostPrice ?? costPrice,
                countInStock: variantStock ?? stock,
                isDefault: true,
                attributes: [],
              },
            ]
          : [],
      costPrice: variantCostPrice ?? costPrice,
      price: variantSalePrice ?? salePrice,
      countInStock: variantStock ?? stock,
      codAvailable: true,
    });

    created += 1;
    processed += 1;
  }

  res.json({
    message: errors.length
      ? 'Stock sheet imported with some skipped rows'
      : 'Stock sheet imported successfully',
    totalProductsProcessed: processed,
    created,
    updated,
    errors,
  });
};

export const uploadOfflineSalesSheet = async (req, res) => {
  if (!req.file?.buffer) {
    res.status(400);
    throw new Error('Please upload a .xlsx or .csv offline sales sheet');
  }

  const rows = parseSheetRows(req.file.buffer);

  if (!rows.length) {
    res.status(400);
    throw new Error('The uploaded sheet is empty');
  }

  let importedSuccessfully = 0;
  let processedRows = 0;
  const errors = [];

  for (const [index, row] of rows.entries()) {
    if (isBlankRow(row)) {
      continue;
    }

    processedRows += 1;

    try {
      const rawProductName = getRowValue(row, ['product name', 'product', 'name']);
      const notes = getRowValue(row, ['notes', 'note']);
      const dayStatus = detectDayStatus(rawProductName, notes);
      let normalizedSale;

      if (dayStatus) {
        normalizedSale = {
          rowType: 'day_status',
          source: 'history_import',
          dayStatus,
          productName: dayStatus,
          saleDate: normalizeSaleDateInput(getRowValue(row, ['date', 'sale date'])),
          quantitySold: 0,
          salePricePerItem: 0,
          totalSale: 0,
          costPricePerItem: 0,
          totalCost: 0,
          profit: 0,
          paymentMode: '',
          notes: toTrimmedString(notes),
        };

        if (!normalizedSale.saleDate) {
          throw new Error('Valid sale date is required');
        }
      } else {
        const matchedProduct = await findProductByFlexibleName(rawProductName);

        if (matchedProduct) {
          normalizedSale = await normalizeOfflineSalePayload({
            saleDate: getRowValue(row, ['date', 'sale date']),
            productName: rawProductName,
            quantitySold: getRowValue(row, ['qty', 'quantity sold', 'quantity']),
            salePricePerItem: getRowValue(row, ['sale price', 'sale price per item']),
            costPricePerItem: getRowValue(row, ['cost price', 'cost price per item']),
            paymentMode: getRowValue(row, ['payment mode', 'payment']),
            pendingAmount: getRowValue(row, ['pending amount', 'pending']),
            customerName: getRowValue(row, ['customer name', 'customer']),
            notes,
            source: 'history_import',
          });
          normalizedSale.rowType = 'product_sale';
          normalizedSale.source = 'history_import';
          normalizedSale.dayStatus = '';
          normalizedSale.productName = matchedProduct.name;
        } else {
          const normalizedSaleDate = normalizeSaleDateInput(getRowValue(row, ['date', 'sale date']));
          const normalizedQuantity = Number(getRowValue(row, ['qty', 'quantity sold', 'quantity']));
          const normalizedSalePrice = Number(getRowValue(row, ['sale price', 'sale price per item']));
          const normalizedPaymentMode = normalizePaymentMode(getRowValue(row, ['payment mode', 'payment']));
          const normalizedCostPrice = toOptionalNumber(getRowValue(row, ['cost price', 'cost price per item'])) ?? 0;
          const normalizedProductName = resolveAliasedProductName(rawProductName);
          const rawPendingAmount = getRowValue(row, ['pending amount', 'pending']);
          const normalizedPendingAmount = toOptionalNumber(rawPendingAmount) ?? 0;
          const normalizedCustomerName = toTrimmedString(
            getRowValue(row, ['customer name', 'customer'])
          );

          if (!normalizedSaleDate) {
            throw new Error('Valid sale date is required');
          }

          if (!normalizedProductName) {
            throw new Error('Product Name is required');
          }

          if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
            throw new Error(`Quantity Sold must be greater than 0. Received: ${getRowValue(row, ['qty', 'quantity sold', 'quantity'])}`);
          }

          if (!Number.isFinite(normalizedSalePrice) || normalizedSalePrice < 0) {
            throw new Error('Sale Price Per Item must be 0 or more');
          }

          if (!normalizedPaymentMode) {
            throw new Error(`Invalid Payment Mode: "${toTrimmedString(getRowValue(row, ['payment mode', 'payment']))}". Use Cash, Pending, or Online/UPI`);
          }

          const totalSale = normalizedQuantity * normalizedSalePrice;
          const totalCost = normalizedQuantity * normalizedCostPrice;
          const paymentDetails = derivePaymentDetails({
            totalSale,
            paymentMode: normalizedPaymentMode,
            pendingAmount: normalizedPendingAmount,
            customerName: normalizedCustomerName,
          });

          normalizedSale = {
            rowType: detectServiceRowType(normalizedProductName),
            source: 'history_import',
            dayStatus: '',
            product: null,
            productName: normalizedProductName,
            saleDate: normalizedSaleDate,
            quantitySold: normalizedQuantity,
            salePricePerItem: normalizedSalePrice,
            totalSale,
            costPricePerItem: normalizedCostPrice,
            totalCost,
            profit: totalSale - totalCost,
            paymentMode: normalizedPaymentMode,
            paymentStatus: paymentDetails.paymentStatus,
            receivedAmount: paymentDetails.receivedAmount,
            pendingAmount: paymentDetails.pendingAmount,
            customerName: paymentDetails.customerName,
            notes: toTrimmedString(notes),
          };
        }
      }

      await createOfflineSaleRecord(normalizedSale, req.user._id);
      importedSuccessfully += 1;
    } catch (error) {
      errors.push(`Row ${index + 2}: ${error.message}`);
    }
  }

  res.json({
    message: errors.length
      ? 'Offline sales sheet imported with some skipped rows'
      : 'Offline sales sheet imported successfully',
    totalRowsProcessed: processedRows,
    importedSuccessfully,
    skippedRows: processedRows - importedSuccessfully,
    errors,
  });
};

// export const createOfflineSale = async (req, res) => {
//   try {
//     const normalizedSale = await normalizeOfflineSalePayload({
//       ...req.body,
//       source: 'manual',
//       strictPaymentMode: true,
//     });
//     const result = await createOfflineSaleRecord(normalizedSale, req.user._id);

//     res.status(201).json({
//       message: 'Offline sale saved successfully',
//       ...result,
//     });
//   } catch (error) {
//     res.status(400);
//     throw error;
//   }
// };

// controllers/adminInventoryController.js mein createOfflineSale replace karo

export const createOfflineSale = async (req, res) => {
  try {
    const {
      saleDate,
      customerName,
      customerPhone,
      paymentMode,
      paidAmount,
      pendingAmount,
      notes,
      items,
      totalSale,
      totalCost,
      totalProfit,
    } = req.body;

    // ── Validation ────────────────────────────────────────
    if (!saleDate) {
      res.status(400);
      throw new Error('Sale date is required');
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400);
      throw new Error('At least one item is required');
    }

    const normalizedPaymentMode = normalizePaymentMode(paymentMode, {
      strict: true,
    });

    if (!normalizedPaymentMode) {
      res.status(400);
      throw new Error(
        `Invalid Payment Mode: "${paymentMode}". Use Cash, Online, or Pending`
      );
    }

    const normalizedSaleDate = normalizeSaleDateInput(saleDate);
    if (!normalizedSaleDate) {
      res.status(400);
      throw new Error('Valid sale date is required');
    }

    const normalizedPendingAmount = Number(pendingAmount ?? 0);
    const normalizedTotalSale = Number(totalSale ?? 0);

    if (normalizedPendingAmount > 0 && !customerName?.trim()) {
      res.status(400);
      throw new Error('Customer name is required when payment is pending');
    }

    // ── Resolve each item's product ───────────────────────
    const resolvedItems = [];
    const appliedStockItems = [];

    for (const item of items) {
      const { productId, productName, quantity, salePrice, costPrice, variantId, variantSku, variantName, variantAttributes } = item;

      let product = null;

      if (productId) {
        product = await Product.findById(productId);
      } else if (productName) {
        product = await findProductByFlexibleName(productName);
      }

      if (!product) {
        res.status(400);
        throw new Error(
          `Product not found: "${productName || productId}"`
        );
      }

      const matchedVariant = resolveProductVariant(product, {
        variantId,
        variantSku,
        variantName,
      });

      const qty = Number(quantity) || 0;
      const sp = Number(salePrice) || 0;
      const cp =
        costPrice !== undefined && costPrice !== ''
          ? Number(costPrice)
          : Number((matchedVariant?.costPrice ?? product.costPrice) || 0);

      if (qty <= 0) {
        res.status(400);
        throw new Error(
          `Quantity must be greater than 0 for product: ${product.name}`
        );
      }

      resolvedItems.push({
        product: product._id,
        productName: product.name,
        variantId: matchedVariant?._id || null,
        variantName: matchedVariant?.name || toTrimmedString(variantName),
        variantSku: matchedVariant?.sku || toTrimmedString(variantSku),
        variantAttributes: normalizeVariantAttributes(
          matchedVariant?.attributes || variantAttributes || []
        ),
        quantity: qty,
        salePrice: sp,
        costPrice: cp,
        totalSale: qty * sp,
        totalCost: qty * cp,
        profit: qty * sp - qty * cp,
        productDoc: product, // stock update ke liye
      });
    }

    // ── Deduct stock for each item ─────────────────────────
    try {
      for (const item of resolvedItems) {
        const updated = await applyProductStockChange(
          item.product,
          item.quantity,
          item,
          -1
        );

        appliedStockItems.push({
          product: item.product,
          quantity: item.quantity,
          variantId: item.variantId,
          variantSku: item.variantSku,
          variantName: item.variantName,
          variantAttributes: item.variantAttributes,
          productName: item.productName,
        });

        item.productDoc = updated;
      }
    } catch (error) {
      for (const appliedItem of appliedStockItems.reverse()) {
        try {
          await applyProductStockChange(appliedItem.product, appliedItem.quantity, appliedItem, 1);
        } catch {
          // best effort rollback
        }
      }

      throw error;
    }

    // ── Build paymentStatus ────────────────────────────────
    let paymentStatus = 'Full Payment';
    if (normalizedPendingAmount > 0 && normalizedPendingAmount < normalizedTotalSale) {
      paymentStatus = 'Partial Payment';
    } else if (normalizedPendingAmount >= normalizedTotalSale) {
      paymentStatus = 'Pending';
    }

    // ── Use first product for legacy single-product fields ─
    const firstItem = resolvedItems[0];

    // ── Create sale document ───────────────────────────────
    const sale = await OfflineSale.create({
      // Legacy single-product fields (backward compat)
      product: firstItem.product,
      productName:
        resolvedItems.length === 1
          ? firstItem.productName
          : resolvedItems.map((i) => i.productName).join(', '),
      quantitySold: resolvedItems.reduce((sum, i) => sum + i.quantity, 0),
      salePricePerItem: firstItem.salePrice,
      costPricePerItem: firstItem.costPrice,

      // Multi-item array
      items: resolvedItems.map(({ productDoc, ...rest }) => rest),

      // Totals
      totalSale: normalizedTotalSale,
      totalCost: Number(totalCost ?? 0),
      profit: Number(totalProfit ?? 0),

      // Payment
      paymentMode: normalizedPaymentMode,
      paymentStatus,
      receivedAmount: Number(paidAmount ?? 0),
      pendingAmount: normalizedPendingAmount,

      // Customer
      customerName: customerName?.trim() || '',
      customerPhone: customerPhone?.trim() || '',

      // Meta
      saleDate: normalizedSaleDate,
      notes: notes?.trim() || '',
      rowType: 'product_sale',
      source: 'manual',
      dayStatus: '',
      createdBy: req.user._id,
    });

    res.status(201).json({
      message: 'Offline sale saved successfully',
      sale,
    });
  } catch (error) {
    if (!res.statusCode || res.statusCode === 200) {
      res.status(400);
    }
    throw error;
  }
};

// export const updateOfflineSale = async (req, res) => {
//   const existingSale = await OfflineSale.findById(req.params.id);

//   if (!existingSale) {
//     res.status(404);
//     throw new Error('Offline sale not found');
//   }

//   try {
//     const normalizedSale = await normalizeOfflineSalePayload({
//       ...req.body,
//       source: existingSale.source || 'manual',
//       strictPaymentMode: true,
//     });
//     const result = await updateOfflineSaleRecord(existingSale, normalizedSale);

//     res.json({
//       message: 'Offline sale updated successfully',
//       ...result,
//     });
//   } catch (error) {
//     res.status(400);
//     throw error;
//   }
// };

export const updateOfflineSale = async (req, res) => {
  try {
    const existingSale = await OfflineSale.findById(req.params.id);

    if (!existingSale) {
      res.status(404);
      throw new Error('Offline sale not found');
    }

    const {
      saleDate,
      customerName,
      customerPhone,
      paymentMode,
      paidAmount,
      pendingAmount,
      notes,
      items,
      totalSale,
      totalCost,
      totalProfit,
    } = req.body;

    const normalizedPaymentMode = normalizePaymentMode(paymentMode, {
      strict: true,
    });

    if (!normalizedPaymentMode) {
      res.status(400);
      throw new Error(`Invalid Payment Mode: "${paymentMode}"`);
    }

    const normalizedSaleDate = normalizeSaleDateInput(saleDate);
    if (!normalizedSaleDate) {
      res.status(400);
      throw new Error('Valid sale date is required');
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400);
      throw new Error('At least one item is required');
    }

    const normalizedPendingAmount = Number(pendingAmount ?? 0);
    const stockRollbackActions = [];

    // ── Restore old stock (manual sales only) ─────────────
    if (existingSale.source !== 'history_import') {
      if (existingSale.items && existingSale.items.length > 0) {
        for (const oldItem of existingSale.items) {
          await applyProductStockChange(oldItem.product, oldItem.quantity, oldItem, 1);
          stockRollbackActions.unshift({ direction: -1, item: oldItem });
        }
      } else if (existingSale.product) {
        const oldItem = {
          productName: existingSale.productName,
          variantId: existingSale.variantId,
          variantSku: existingSale.variantSku,
          variantName: existingSale.variantName,
          variantAttributes: existingSale.variantAttributes,
        };

        await applyProductStockChange(existingSale.product, existingSale.quantitySold, oldItem, 1);
        stockRollbackActions.unshift({
          direction: -1,
          item: {
            product: existingSale.product,
            quantity: existingSale.quantitySold,
            ...oldItem,
          },
        });
      }
    }

    // ── Resolve new items ──────────────────────────────────
    const resolvedItems = [];

    for (const item of items) {
      const {
        productId,
        productName,
        quantity,
        salePrice,
        costPrice,
        variantId,
        variantSku,
        variantName,
        variantAttributes,
      } = item;

      let product = null;

      if (productId) {
        product = await Product.findById(productId);
      } else if (productName) {
        product = await findProductByFlexibleName(productName);
      }

      if (!product) {
        throw new Error(`Product not found: "${productName || productId}"`);
      }

      const matchedVariant = resolveProductVariant(product, {
        variantId,
        variantSku,
        variantName,
      });

      const qty = Number(quantity) || 0;
      const sp = Number(salePrice) || 0;
      const cp =
        costPrice !== undefined && costPrice !== ''
          ? Number(costPrice)
          : Number((matchedVariant?.costPrice ?? product.costPrice) || 0);

      resolvedItems.push({
        product: product._id,
        productName: product.name,
        variantId: matchedVariant?._id || null,
        variantName: matchedVariant?.name || toTrimmedString(variantName),
        variantSku: matchedVariant?.sku || toTrimmedString(variantSku),
        variantAttributes: normalizeVariantAttributes(
          matchedVariant?.attributes || variantAttributes || []
        ),
        quantity: qty,
        salePrice: sp,
        costPrice: cp,
        totalSale: qty * sp,
        totalCost: qty * cp,
        profit: qty * sp - qty * cp,
      });
    }

    // ── Deduct new stock (manual only) ────────────────────
    if (existingSale.source !== 'history_import') {
      try {
        for (const item of resolvedItems) {
          await applyProductStockChange(item.product, item.quantity, item, -1);
          stockRollbackActions.unshift({ direction: 1, item });
        }
      } catch (error) {
        for (const action of stockRollbackActions) {
          try {
            await applyProductStockChange(
              action.item.product || action.item._id || action.item.productId || existingSale.product,
              action.item.quantity || existingSale.quantitySold || 0,
              action.item,
              action.direction
            );
          } catch {
            // best effort rollback
          }
        }

        throw error;
      }
    }

    // ── paymentStatus ──────────────────────────────────────
    const normalizedTotalSale = Number(totalSale ?? 0);
    let paymentStatus = 'Full Payment';
    if (normalizedPendingAmount > 0 && normalizedPendingAmount < normalizedTotalSale) {
      paymentStatus = 'Partial Payment';
    } else if (normalizedPendingAmount >= normalizedTotalSale) {
      paymentStatus = 'Pending';
    }

    const firstItem = resolvedItems[0];

    // ── Update fields ──────────────────────────────────────
    existingSale.product = firstItem.product;
    existingSale.productName =
      resolvedItems.length === 1
        ? firstItem.productName
        : resolvedItems.map((i) => i.productName).join(', ');
    existingSale.variantId = firstItem.variantId || null;
    existingSale.variantName = firstItem.variantName || '';
    existingSale.variantSku = firstItem.variantSku || '';
    existingSale.variantAttributes = firstItem.variantAttributes || [];
    existingSale.quantitySold = resolvedItems.reduce((s, i) => s + i.quantity, 0);
    existingSale.salePricePerItem = firstItem.salePrice;
    existingSale.costPricePerItem = firstItem.costPrice;
    existingSale.items = resolvedItems;
    existingSale.totalSale = normalizedTotalSale;
    existingSale.totalCost = Number(totalCost ?? 0);
    existingSale.profit = Number(totalProfit ?? 0);
    existingSale.paymentMode = normalizedPaymentMode;
    existingSale.paymentStatus = paymentStatus;
    existingSale.receivedAmount = Number(paidAmount ?? 0);
    existingSale.pendingAmount = normalizedPendingAmount;
    existingSale.customerName = customerName?.trim() || '';
    existingSale.customerPhone = customerPhone?.trim() || '';
    existingSale.saleDate = normalizedSaleDate;
    existingSale.notes = notes?.trim() || '';

    const sale = await existingSale.save();

    res.json({
      message: 'Offline sale updated successfully',
      sale,
    });
  } catch (error) {
    if (!res.statusCode || res.statusCode === 200) {
      res.status(400);
    }
    throw error;
  }
};

export const deleteOfflineSale = async (req, res) => {
  const sale = await OfflineSale.findById(req.params.id);

  if (!sale) {
    res.status(404);
    throw new Error('Offline sale not found');
  }

  if (sale.source !== 'history_import' && sale.rowType === 'product_sale' && sale.product) {
    await applyProductStockChange(
      sale.product,
      sale.quantitySold,
      {
        productName: sale.productName,
        variantId: sale.variantId,
        variantSku: sale.variantSku,
        variantName: sale.variantName,
        variantAttributes: sale.variantAttributes,
      },
      1
    );
  }

  await OfflineSale.deleteOne({ _id: sale._id });

  res.json({ message: 'Offline sale deleted successfully' });
};

export const getOfflineSales = async (req, res) => {
  const query = getDateRangeQuery(req.query);
  const sales = await OfflineSale.find(query).sort({ saleDate: -1, createdAt: -1 });
  const summary = summarizeSales(sales);

  res.json({
    sales,
    summary,
  });
};

export const getPendingOfflinePayments = async (req, res) => {
  const { fromDate, toDate } = req.query;
  const rangeConditions = [];

  if (fromDate || toDate) {
    const dateRange = {};

    if (fromDate) {
      const start = new Date(`${fromDate}T00:00:00.000Z`);
      if (!Number.isNaN(start.getTime())) {
        dateRange.$gte = start;
      }
    }

    if (toDate) {
      const end = new Date(`${toDate}T23:59:59.999Z`);
      if (!Number.isNaN(end.getTime())) {
        dateRange.$lte = end;
      }
    }

    if ((fromDate && !dateRange.$gte) || (toDate && !dateRange.$lte)) {
      res.status(400);
      throw new Error('Valid fromDate/toDate are required');
    }

    if (dateRange.$gte || dateRange.$lte) {
      rangeConditions.push({ saleDate: dateRange }, { date: dateRange });
    }
  }

  const query = {
    $and: [
      { $or: [{ pendingAmount: { $gt: 0 } }, { paymentMode: 'Pending' }] },
      ...(rangeConditions.length ? [{ $or: rangeConditions }] : []),
    ],
  };

  const pendingSales = await OfflineSale.find(query).sort({ saleDate: 1, createdAt: 1 });

  const normalizedEntries = pendingSales
    .map((sale) => {
      const totalSale = Number(sale.totalSale || 0);
      const storedPendingAmount = Number(sale.pendingAmount || 0);
      const inferredPendingAmount =
        storedPendingAmount > 0
          ? storedPendingAmount
          : sale.paymentMode === 'Pending' && totalSale > 0
            ? totalSale
            : 0;
      const pendingAmount = inferredPendingAmount;
      const paidAmount = totalSale - pendingAmount;
      const saleDate = sale.saleDate || sale.date || null;

      return {
        _id: sale._id,
        date: saleDate,
        customerName: sale.customerName || '',
        productName: sale.productName || '',
        totalSale,
        paidAmount,
        pendingAmount,
        paymentMode: sale.paymentMode || '',
        notes: sale.notes || '',
      };
    })
    .filter((sale) => sale.pendingAmount > 0)
    .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

  const totalPendingAmount = normalizedEntries.reduce(
    (sum, sale) => sum + Number(sale.pendingAmount || 0),
    0
  );
  const totalPendingEntries = normalizedEntries.length;
  const totalUniqueCustomers = new Set(
    normalizedEntries
      .map((sale) => String(sale.customerName || '').trim())
      .filter(Boolean)
  ).size;

  res.json({
    pendingPayments: normalizedEntries,
    summary: {
      totalPendingAmount,
      totalPendingEntries,
      totalUniqueCustomers,
    },
  });
};
