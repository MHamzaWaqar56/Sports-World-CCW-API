
// controllers/promoController.js
import Promo from '../models/Promo.js';

/* ─────────────────────────────────────────────────────────
   VALIDATE PROMO  (existing — updated with maxUses check)
   POST /orders/promo/validate
───────────────────────────────────────────────────────── */
export const validatePromo = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ message: 'Promo code is required' });
    }

    const promo = await Promo.findOne({ code: code.toUpperCase() });

    if (!promo || !promo.isActive) {
      return res.status(400).json({ message: 'Invalid or inactive promo code' });
    }

    if (promo.expiryDate && promo.expiryDate < new Date()) {
      return res.status(400).json({ message: 'Promo code has expired' });
    }

    // ── maxUses check ──────────────────────────
    if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
      return res.status(400).json({ message: 'Promo code usage limit reached' });
    }

    res.json({
      success: true,
      discountPercentage: promo.discountPercentage,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error validating promo' });
  }
};

/* ─────────────────────────────────────────────────────────
   CREATE PROMO  (existing — updated with maxUses support)
   POST /orders/create-promo
───────────────────────────────────────────────────────── */
export const createPromo = async (req, res) => {
  try {
    const { code, discountPercentage, expiryDate, maxUses } = req.body;

    if (!code || !discountPercentage) {
      return res.status(400).json({ message: 'Code and discount are required' });
    }

    const existing = await Promo.findOne({ code: code.toUpperCase() });
    if (existing) {
      return res.status(400).json({ message: 'Promo code already exists' });
    }

    const promo = await Promo.create({
      code: code.toUpperCase(),
      discountPercentage,
      expiryDate: expiryDate || null,
      maxUses: maxUses || null,
      isActive: true,
    });

    res.status(201).json(promo);
  } catch (error) {
    res.status(500).json({ message: 'Server error creating promo' });
  }
};

/* ─────────────────────────────────────────────────────────
   GET ALL PROMOS
   GET /orders/promos
───────────────────────────────────────────────────────── */
export const getAllPromos = async (req, res) => {
  try {
    const promos = await Promo.find().sort({ createdAt: -1 });
    res.json(promos);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching promos' });
  }
};

/* ─────────────────────────────────────────────────────────
   TOGGLE ACTIVE / INACTIVE
   PATCH /orders/promo/:id/toggle
───────────────────────────────────────────────────────── */
export const togglePromo = async (req, res) => {
  try {
    const promo = await Promo.findById(req.params.id);

    if (!promo) {
      return res.status(404).json({ message: 'Promo not found' });
    }

    promo.isActive = !promo.isActive;
    await promo.save();

    res.json({
      success: true,
      message: `Promo ${promo.isActive ? 'activated' : 'deactivated'} successfully`,
      promo,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error toggling promo' });
  }
};

/* ─────────────────────────────────────────────────────────
   PROMO USAGE STATS
   GET /orders/promo/:id/stats
───────────────────────────────────────────────────────── */
export const getPromoStats = async (req, res) => {
  try {
    const promo = await Promo.findById(req.params.id);

    if (!promo) {
      return res.status(404).json({ message: 'Promo not found' });
    }

    const now = new Date();
    const isExpired = promo.expiryDate && promo.expiryDate < now;
    const usesRemaining =
      promo.maxUses !== null ? promo.maxUses - promo.usedCount : null;

    res.json({
      code: promo.code,
      discountPercentage: promo.discountPercentage,
      isActive: promo.isActive,
      isExpired,
      usedCount: promo.usedCount,
      maxUses: promo.maxUses,
      usesRemaining,
      totalDiscountGiven: promo.totalDiscountGiven,
      expiryDate: promo.expiryDate,
      createdAt: promo.createdAt,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching promo stats' });
  }
};

/* ─────────────────────────────────────────────────────────
   DELETE SINGLE PROMO
   DELETE /orders/promo/:id
───────────────────────────────────────────────────────── */
export const deletePromo = async (req, res) => {
  try {
    const promo = await Promo.findByIdAndDelete(req.params.id);

    if (!promo) {
      return res.status(404).json({ message: 'Promo not found' });
    }

    res.json({ success: true, message: 'Promo deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error deleting promo' });
  }
};

/* ─────────────────────────────────────────────────────────
   BULK DELETE EXPIRED
   DELETE /orders/promos/expired
───────────────────────────────────────────────────────── */
export const deleteExpiredPromos = async (req, res) => {
  try {
    const result = await Promo.deleteMany({
      expiryDate: { $lt: new Date() },
    });

    res.json({
      success: true,
      message: `${result.deletedCount} expired promo(s) deleted`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error deleting expired promos' });
  }
};

/* ─────────────────────────────────────────────────────────
   INCREMENT USAGE  (call this inside your order creation)
   Internal helper — not a route
───────────────────────────────────────────────────────── */
export const incrementPromoUsage = async (code, discountAmount) => {
  try {
    await Promo.findOneAndUpdate(
      { code: code.toUpperCase() },
      {
        $inc: {
          usedCount: 1,
          totalDiscountGiven: discountAmount,
        },
      }
    );
  } catch (error) {
    console.error('Failed to increment promo usage:', error);
  }
};