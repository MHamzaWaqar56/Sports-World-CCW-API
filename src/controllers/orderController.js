import Order from '../models/Order.js';
import Promo from '../models/Promo.js';
import Product from '../models/Product.js';
import { incrementPromoUsage } from './promoController.js';
import sendEmail from '../utils/sendEmail.js';

const roundCurrency = (value) => Number(Number(value || 0).toFixed(2));

const calculateShippingPriceFromSubtotal = (subtotal) => {
  const normalizedSubtotal = roundCurrency(subtotal);

  if (normalizedSubtotal >= 5000) return 0;
  if (normalizedSubtotal <= 500) return 50;
  if (normalizedSubtotal <= 1000) return 100;
  if (normalizedSubtotal <= 2000) return 150;
  if (normalizedSubtotal <= 4000) return 180;

  return 200;
};

const calculateOrderAmounts = (baseAmount) => {
  const normalizedBaseAmount = roundCurrency(baseAmount);
  const shippingPrice = roundCurrency(
    calculateShippingPriceFromSubtotal(normalizedBaseAmount)
  );
  const tax = 0;
  const finalAmount = roundCurrency(normalizedBaseAmount + shippingPrice);

  return {
    baseAmount: normalizedBaseAmount,
    shippingPrice,
    tax,
    finalAmount,
  };
};

const calculateOrderAmountsFromItems = (orderItems) => {
  const baseAmount = orderItems.reduce(
    (sum, item) => sum + Number(item.price) * Number(item.qty),
    0
  );

  return calculateOrderAmounts(baseAmount);
};

const normalizeVariantAttributes = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).map(([name, attributeValue]) => ({
      name,
      value: attributeValue,
    }));
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

    throw new Error(`Variant not found for ${product.name}`);
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
    throw new Error(`Variant not found for ${product.name}`);
  }

  return product.variants.find((variant) => variant.isDefault) || product.variants[0];
};

const mapOrderItemsFromProducts = async (orderItems) => {
  const productIds = orderItems.map((item) => item._id || item.product);
  const products = await Product.find({ _id: { $in: productIds } });

  return orderItems.map((item) => {
    const matchedProduct = products.find(
      (product) => product._id.toString() === String(item._id || item.product)
    );

    if (!matchedProduct) {
      throw new Error(`Product not found for item ${item.name || item._id}`);
    }

    const matchedVariant = resolveProductVariant(matchedProduct, item);
    const availableStock = matchedVariant
      ? Number(matchedVariant.countInStock || 0)
      : Number(matchedProduct.countInStock || 0);

    if (availableStock < Number(item.qty)) {
      throw new Error(
        matchedVariant
          ? `Insufficient stock for ${matchedProduct.name} - ${matchedVariant.name}`
          : `Insufficient stock for ${matchedProduct.name}`
      );
    }

    return {
      name: matchedProduct.name,
      qty: Number(item.qty),
      image: matchedVariant?.image || matchedProduct.image,
      price: matchedVariant?.price ?? matchedProduct.price,
      costPrice: matchedVariant?.costPrice ?? matchedProduct.costPrice ?? 0,
      product: matchedProduct._id,
      variantId: matchedVariant?._id || null,
      variantName: matchedVariant?.name || '',
      variantSku: matchedVariant?.sku || '',
      variantAttributes: normalizeVariantAttributes(matchedVariant?.attributes || []),
    };
  });
};

const ensureStockAvailability = async (orderItems) => {
  const productIds = orderItems.map((item) => item.product || item._id);
  const products = await Product.find({ _id: { $in: productIds } });

  orderItems.forEach((item) => {
    const matchedProduct = products.find(
      (product) => product._id.toString() === String(item.product || item._id)
    );

    if (!matchedProduct) {
      throw new Error(`Product not found for item ${item.name || item._id}`);
    }

    const matchedVariant = resolveProductVariant(matchedProduct, item);
    const availableStock = matchedVariant
      ? Number(matchedVariant.countInStock || 0)
      : Number(matchedProduct.countInStock || 0);

    if (availableStock < Number(item.qty)) {
      throw new Error(
        matchedVariant
          ? `Insufficient stock for ${matchedProduct.name} - ${matchedVariant.name}`
          : `Insufficient stock for ${matchedProduct.name}`
      );
    }
  });
};

const decrementStockForItems = async (orderItems) => {
  for (const item of orderItems) {
    const product = await Product.findById(item.product);

    if (!product) {
      throw new Error(`Product not found for item ${item.name || item.product}`);
    }

    const matchedVariant = resolveProductVariant(product, item);

    if (matchedVariant) {
      matchedVariant.countInStock = Number(matchedVariant.countInStock || 0) - Number(item.qty);

      if (matchedVariant.countInStock < 0) {
        throw new Error(`Insufficient stock for ${product.name} - ${matchedVariant.name}`);
      }
    } else {
      product.countInStock = Number(product.countInStock || 0) - Number(item.qty);

      if (product.countInStock < 0) {
        throw new Error(`Insufficient stock for ${product.name}`);
      }
    }

    product.countInStock = product.variants.length
      ? product.variants.reduce((sum, variant) => sum + Number(variant.countInStock || 0), 0)
      : Number(product.countInStock || 0);

    await product.save();
  }
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildAdminOrderAlertEmail = ({ order, customerName, customerEmail }) => {
  const orderId = String(order._id || '').slice(-8).toUpperCase();
  const adminOrdersLink = process.env.FRONTEND_URL
    ? `${process.env.FRONTEND_URL.replace(/\/$/, '')}/admin/orders`
    : '';

  const orderItemsHtml = order.orderItems
    .map(
      (item) => `
        <tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(item.name)}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${Number(item.qty || 0)}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">Rs. ${Number(item.price || 0).toFixed(2)}</td>
        </tr>`,
    )
    .join('');

  const addressParts = [
    order.shippingAddress?.fullName,
    order.shippingAddress?.phone,
    order.shippingAddress?.address,
    order.shippingAddress?.city,
    order.shippingAddress?.postalCode,
    order.shippingAddress?.country,
  ]
    .filter(Boolean)
    .map(escapeHtml)
    .join(', ');

  return `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
      <h2 style="margin: 0 0 12px;">New Order Received</h2>
      <p style="margin: 0 0 16px;">A new order has been placed on Sports World.</p>

      <div style="padding: 16px; border: 1px solid #e5e7eb; border-radius: 12px; margin-bottom: 16px;">
        <p style="margin: 0 0 8px;"><strong>Order ID:</strong> #${escapeHtml(orderId)}</p>
        <p style="margin: 0 0 8px;"><strong>Customer:</strong> ${escapeHtml(customerName || 'Customer')}</p>
        <p style="margin: 0 0 8px;"><strong>Email:</strong> ${escapeHtml(customerEmail || 'N/A')}</p>
        <p style="margin: 0 0 8px;"><strong>Payment Method:</strong> ${escapeHtml(order.paymentMethod || 'N/A')}</p>
        <p style="margin: 0;"><strong>Total:</strong> Rs. ${Number(order.totalPrice || 0).toFixed(2)}</p>
      </div>

      <div style="padding: 16px; border: 1px solid #e5e7eb; border-radius: 12px; margin-bottom: 16px;">
        <p style="margin: 0 0 8px;"><strong>Shipping Address:</strong></p>
        <p style="margin: 0;">${addressParts || 'N/A'}</p>
      </div>

      <div style="margin-bottom: 16px;">
        <p style="margin: 0 0 8px;"><strong>Order Items:</strong></p>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="padding: 10px 12px; text-align: left; border-bottom: 1px solid #e5e7eb;">Product</th>
              <th style="padding: 10px 12px; text-align: center; border-bottom: 1px solid #e5e7eb;">Qty</th>
              <th style="padding: 10px 12px; text-align: right; border-bottom: 1px solid #e5e7eb;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${orderItemsHtml}
          </tbody>
        </table>
      </div>

      ${adminOrdersLink ? `<p style="margin: 0 0 10px;"><a href="${escapeHtml(adminOrdersLink)}" style="color: #dc2626; font-weight: 700; text-decoration: none;">View order in dashboard</a></p>` : ''}
    </div>
  `;
};

const buildCustomerDispatchEmail = ({ order, customerName }) => {
  const orderId = String(order._id || '').slice(-8).toUpperCase();

  return `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
      <h2 style="margin: 0 0 12px;">Your Order Has Been Dispatched</h2>
      <p style="margin: 0 0 12px;">Hi ${escapeHtml(customerName || 'Customer')},</p>
      <p style="margin: 0 0 12px;">Your order <strong>#${escapeHtml(orderId)}</strong> has been dispatched.</p>
      <p style="margin: 0 0 16px;">Our rider is on the way and you should receive it in the next <strong>few minutes</strong>.</p>
      <p style="margin: 0;">Thank you for shopping with Sports World Chichawatni.</p>
    </div>
  `;
};

const buildCustomerCancellationEmailBySeller = ({ order, customerName, reason }) => {
  const orderId = String(order._id || '').slice(-8).toUpperCase();

  return `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
      <h2 style="margin: 0 0 12px;">Your Order Has Been Cancelled</h2>
      <p style="margin: 0 0 12px;">Hi ${escapeHtml(customerName || 'Customer')},</p>
      <p style="margin: 0 0 12px;">Your order <strong>#${escapeHtml(orderId)}</strong> has been cancelled by the seller.</p>
      <div style="padding: 12px 14px; border: 1px solid #e5e7eb; border-radius: 10px; margin: 0 0 14px; background: #f9fafb;">
        <p style="margin: 0;">
          <strong>Reason:</strong> ${escapeHtml(reason || 'Not provided')}
        </p>
      </div>
      <p style="margin: 0;">If you need help, please contact Sports World support.</p>
    </div>
  `;
};

const buildAdminCancellationEmailByCustomer = ({ order, customerName, customerEmail }) => {
  const orderId = String(order._id || '').slice(-8).toUpperCase();

  return `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
      <h2 style="margin: 0 0 12px;">Order Cancelled By Customer</h2>
      <p style="margin: 0 0 12px;">A customer has cancelled an order.</p>
      <div style="padding: 14px; border: 1px solid #e5e7eb; border-radius: 12px; margin-bottom: 12px;">
        <p style="margin: 0 0 8px;"><strong>Order ID:</strong> #${escapeHtml(orderId)}</p>
        <p style="margin: 0 0 8px;"><strong>Customer:</strong> ${escapeHtml(customerName || 'Customer')}</p>
        <p style="margin: 0;"><strong>Email:</strong> ${escapeHtml(customerEmail || 'N/A')}</p>
      </div>
      <p style="margin: 0;">Please review the order timeline in the dashboard.</p>
    </div>
  `;
};



export const addOrderItems = async (req, res) => {
  const { orderItems, shippingAddress, paymentMethod, promoCode } = req.body;

  if (!Array.isArray(orderItems) || orderItems.length === 0) {
    res.status(400);
    throw new Error('No order items');
  }

  const sanitizedItems = await mapOrderItemsFromProducts(orderItems);

  let { baseAmount, shippingPrice, tax, finalAmount } =
    calculateOrderAmountsFromItems(sanitizedItems);

  // ================== PROMO LOGIC ==================
  let discountAmount = 0;
  let appliedPromo = null;

  if (promoCode) {
    const promo = await Promo.findOne({
      code: promoCode.toUpperCase(),
      isActive: true,
    });

    if (!promo) {
      res.status(400);
      throw new Error('Invalid promo code');
    }

    if (promo.expiryDate && promo.expiryDate < new Date()) {
      res.status(400);
      throw new Error('Promo code expired');
    }

    const preDiscountTotal = finalAmount;

    discountAmount = roundCurrency(
      preDiscountTotal * (promo.discountPercentage / 100)
    );

    finalAmount = roundCurrency(preDiscountTotal - discountAmount);

    appliedPromo = promo.code;
  }

  // ================== CREATE ORDER ==================
  const order = await Order.create({
    user: req.user._id,
    orderItems: sanitizedItems,
    shippingAddress,
    paymentMethod,

    itemsPrice: baseAmount,
    shippingPrice,
    taxPrice: tax,

    discountAmount,        // ✅ NOW SAVED
    promoCode: appliedPromo, // ✅ NOW SAVED

    totalPrice: finalAmount,

    isPaid: false,
    paidAt: null,
    paymentResult: {
      status: 'COD_PENDING_COLLECTION',
    },
  });

  if (promoCode && discountAmount) {
  await incrementPromoUsage(promoCode, discountAmount);
}

  await ensureStockAvailability(sanitizedItems);
  await decrementStockForItems(sanitizedItems);

  const adminEmail = process.env.ADMIN_EMAIL?.trim();

  if (adminEmail) {
    try {
      await sendEmail({
        email: adminEmail,
        subject: `New Order Received - #${String(order._id).slice(-8).toUpperCase()}`,
        message: buildAdminOrderAlertEmail({
          order,
          customerName: req.user?.name,
          customerEmail: req.user?.email,
        }),
      });
    } catch (emailError) {
      console.error('Failed to send admin order alert email:', emailError);
    }
  } else {
    console.warn('ADMIN_EMAIL is not configured. Skipping admin order alert email.');
  }

  res.status(201).json(order);
};

export const getOrderById = async (req, res) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email');

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  const canAccess =
    req.user.role === 'seller' ||
    order.user._id.toString() === req.user._id.toString();

  if (!canAccess) {
    res.status(403);
    throw new Error('Not authorized to view this order');
  }

  res.json(order);
};

export const updateOrderToPaid = async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  const canAccess =
    req.user.role === 'seller' || order.user.toString() === req.user._id.toString();

  if (!canAccess) {
    res.status(403);
    throw new Error('Not authorized to update this order');
  }

  if (order.isCancelled) {
    res.status(400);
    throw new Error('Cancelled order cannot be marked as paid');
  }

  if (order.isPaid) {
    return res.json(order);
  }

  // Seller manually marks COD as paid after collecting cash
  order.paymentResult = {
    status: 'PAID',
    update_time: Date.now(),
  };
  order.isPaid = true;
  order.paidAt = Date.now();

  const updatedOrder = await order.save();
  res.json(updatedOrder);
};

export const updateOrderToDelivered = async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  if (order.isCancelled) {
    res.status(400);
    throw new Error('Cancelled order cannot be marked as delivered');
  }

  if (!order.isDispatched) {
    res.status(400);
    throw new Error('Order must be dispatched before marking delivered');
  }

  if (order.isDelivered) {
    return res.json(order);
  }

  order.isDelivered = true;
  order.deliveredAt = Date.now();

  const updatedOrder = await order.save();
  res.json(updatedOrder);
};

export const updateOrderToDispatched = async (req, res) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email');

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  if (order.isCancelled) {
    res.status(400);
    throw new Error('Cancelled order cannot be marked as dispatched');
  }

  if (order.isDelivered) {
    res.status(400);
    throw new Error('Delivered order cannot be marked as dispatched');
  }

  if (order.isDispatched) {
    return res.json(order);
  }

  order.isDispatched = true;
  order.dispatchedAt = Date.now();

  const updatedOrder = await order.save();

  const customerEmail = order.user?.email?.trim();
  if (customerEmail) {
    try {
      await sendEmail({
        email: customerEmail,
        subject: `Order Dispatched - #${String(order._id).slice(-8).toUpperCase()}`,
        message: buildCustomerDispatchEmail({
          order,
          customerName: order.user?.name,
        }),
      });
    } catch (emailError) {
      console.error('Failed to send dispatch email to customer:', emailError);
    }
  } else {
    console.warn(`Customer email missing for order ${String(order._id)}. Skipping dispatch email.`);
  }

  res.json(updatedOrder);
};

export const deleteOrder = async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  await order.deleteOne();

  res.json({
    success: true,
    message: 'Order deleted successfully',
  });
};

export const getMyOrders = async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json(orders);
};

export const getOrders = async (req, res) => {
  const orders = await Order.find({})
    .populate('user', 'id name email')
    .sort({ createdAt: -1 });

  res.json(orders);
};

export const cancelOrder = async (req, res) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email');

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  // Only owner or seller can cancel
  const canAccess =
    req.user.role === 'seller' ||
    (order.user?._id || order.user).toString() === req.user._id.toString();

  if (!canAccess) {
    res.status(403);
    throw new Error('Not authorized to cancel this order');
  }

  // ❌ Already cancelled
  if (order.isCancelled) {
    res.status(400);
    throw new Error('Order already cancelled');
  }

  // ❌ Restriction condition
  if (order.isDispatched || order.isDelivered) {
    res.status(400);
    throw new Error('Order cannot be cancelled');
  }

  // ✅ Restore stock
  for (const item of order.orderItems) {
    const product = await Product.findById(item.product);

    if (!product) {
      throw new Error(`Product not found for item ${item.name || item.product}`);
    }

    const matchedVariant = resolveProductVariant(product, item);

    if (matchedVariant) {
      matchedVariant.countInStock = Number(matchedVariant.countInStock || 0) + Number(item.qty);
    } else {
      product.countInStock = Number(product.countInStock || 0) + Number(item.qty);
    }

    product.countInStock = product.variants.length
      ? product.variants.reduce((sum, variant) => sum + Number(variant.countInStock || 0), 0)
      : Number(product.countInStock || 0);

    await product.save();
  }

  // ✅ Update order status
  order.isCancelled = true;
  order.cancelledAt = Date.now();
  order.cancelledBy = req.user.role === 'seller' ? 'seller' : 'customer';

  const updatedOrder = await order.save();

  if (req.user.role !== 'seller') {
    const adminEmail = process.env.ADMIN_EMAIL?.trim();
    if (adminEmail) {
      try {
        await sendEmail({
          email: adminEmail,
          subject: `Order Cancelled By Customer - #${String(order._id).slice(-8).toUpperCase()}`,
          message: buildAdminCancellationEmailByCustomer({
            order,
            customerName: order.user?.name,
            customerEmail: order.user?.email,
          }),
        });
      } catch (emailError) {
        console.error('Failed to send customer-cancel notification to seller/admin:', emailError);
      }
    } else {
      console.warn('ADMIN_EMAIL is not configured. Skipping customer-cancel notification email.');
    }
  }

  res.json({
    success: true,
    message: 'Order cancelled successfully',
    order: updatedOrder,
  });
};

export const updateCancelledOrderReason = async (req, res) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email');

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  if (!order.isCancelled) {
    res.status(400);
    throw new Error('Only cancelled orders can have a cancel reason');
  }

  const reason = String(req.body?.reason || '').trim();

  if (!reason) {
    res.status(400);
    throw new Error('Cancel reason is required');
  }

  order.cancelReason = reason;

  const updatedOrder = await order.save();

  if (order.cancelledBy === 'seller') {
    const customerEmail = order.user?.email?.trim();
    if (customerEmail) {
      try {
        await sendEmail({
          email: customerEmail,
          subject: `Order Cancelled - #${String(order._id).slice(-8).toUpperCase()}`,
          message: buildCustomerCancellationEmailBySeller({
            order,
            customerName: order.user?.name,
            reason,
          }),
        });
      } catch (emailError) {
        console.error('Failed to send seller-cancel reason email to customer:', emailError);
      }
    } else {
      console.warn(`Customer email missing for order ${String(order._id)}. Skipping cancel-reason email.`);
    }
  }

  res.json({
    success: true,
    message: 'Cancel reason saved successfully',
    order: updatedOrder,
  });
};