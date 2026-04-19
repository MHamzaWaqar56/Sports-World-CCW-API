import BatRepair from '../models/BatRepair.js';

const roundCurrency = (value) => Number(Number(value || 0).toFixed(2));

const getDateRangeQuery = ({ date, month, from, to }) => {
  if (date) {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(`${date}T23:59:59.999Z`);

    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      return { date: { $gte: start, $lte: end } };
    }
  }

  if (month) {
    const start = new Date(`${month}-01T00:00:00.000Z`);

    if (!Number.isNaN(start.getTime())) {
      const end = new Date(start);
      end.setUTCMonth(end.getUTCMonth() + 1);
      end.setUTCMilliseconds(end.getUTCMilliseconds() - 1);
      return { date: { $gte: start, $lte: end } };
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
      return { date: range };
    }
  }

  return {};
};

const normalizeRepairPayload = (payload = {}) => {
  const normalizedDate = new Date(payload.date);
  const normalizedCharge = Number(payload.charge);
  const normalizedCost = Number(payload.cost);

  if (Number.isNaN(normalizedDate.getTime())) {
    throw new Error('Valid repair date is required');
  }

  if (!['Binding', 'Handle', 'Full Repair'].includes(payload.repairType)) {
    throw new Error('Valid repair type is required');
  }

  if (!Number.isFinite(normalizedCharge) || normalizedCharge < 0) {
    throw new Error('Charge amount must be 0 or more');
  }

  if (!Number.isFinite(normalizedCost) || normalizedCost < 0) {
    throw new Error('Cost amount must be 0 or more');
  }

  return {
    date: normalizedDate,
    customerName: String(payload.customerName || '').trim(),
    repairType: payload.repairType,
    charge: roundCurrency(normalizedCharge),
    cost: roundCurrency(normalizedCost),
    profit: roundCurrency(normalizedCharge - normalizedCost),
    notes: String(payload.notes || '').trim(),
  };
};

const summarizeRepairs = (repairs) =>
  repairs.reduce(
    (summary, repair) => ({
      totalRepairIncome: roundCurrency(summary.totalRepairIncome + Number(repair.charge || 0)),
      totalRepairCost: roundCurrency(summary.totalRepairCost + Number(repair.cost || 0)),
      totalRepairProfit: roundCurrency(summary.totalRepairProfit + Number(repair.profit || 0)),
    }),
    {
      totalRepairIncome: 0,
      totalRepairCost: 0,
      totalRepairProfit: 0,
    }
  );

export const createBatRepair = async (req, res) => {
  try {
    const normalizedRepair = normalizeRepairPayload(req.body);
    const repair = await BatRepair.create({
      ...normalizedRepair,
      createdBy: req.user._id,
    });

    res.status(201).json({
      message: 'Bat repair saved successfully',
      repair,
    });
  } catch (error) {
    res.status(400);
    throw error;
  }
};

export const getBatRepairs = async (req, res) => {
  const query = getDateRangeQuery(req.query);
  const repairs = await BatRepair.find(query).sort({ date: -1, createdAt: -1 });
  const summary = summarizeRepairs(repairs);

  res.json({
    repairs,
    summary,
  });
};

export const deleteBatRepair = async (req, res) => {
  const repair = await BatRepair.findById(req.params.id);

  if (!repair) {
    res.status(404);
    throw new Error('Bat repair not found');
  }

  await BatRepair.deleteOne({ _id: repair._id });

  res.json({ message: 'Bat repair deleted successfully' });
};