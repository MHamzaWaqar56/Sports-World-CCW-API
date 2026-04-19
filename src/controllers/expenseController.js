import Expense from '../models/Expense.js';

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

const normalizeExpensePayload = (payload = {}) => {
  const normalizedDate = new Date(payload.date);
  const normalizedAmount = Number(payload.amount);

  if (Number.isNaN(normalizedDate.getTime())) {
    throw new Error('Valid expense date is required');
  }

  if (
    !['Petrol', 'Food', 'Electricity Bill', 'Rent', 'Courier', 'Packing', 'Other'].includes(
      payload.expenseType
    )
  ) {
    throw new Error('Valid expense type is required');
  }

  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    throw new Error('Expense amount must be greater than 0');
  }

  return {
    date: normalizedDate,
    expenseType: payload.expenseType,
    amount: roundCurrency(normalizedAmount),
    notes: String(payload.notes || '').trim(),
  };
};

const summarizeExpenses = (expenses) =>
  expenses.reduce(
    (summary, expense) => ({
      totalExpenses: roundCurrency(summary.totalExpenses + Number(expense.amount || 0)),
    }),
    { totalExpenses: 0 }
  );

export const createExpense = async (req, res) => {
  try {
    const normalizedExpense = normalizeExpensePayload(req.body);
    const expense = await Expense.create({
      ...normalizedExpense,
      createdBy: req.user._id,
    });

    res.status(201).json({
      message: 'Expense saved successfully',
      expense,
    });
  } catch (error) {
    res.status(400);
    throw error;
  }
};

export const getExpenses = async (req, res) => {
  const query = getDateRangeQuery(req.query);
  const expenses = await Expense.find(query).sort({ date: -1, createdAt: -1 });
  const summary = summarizeExpenses(expenses);

  res.json({
    expenses,
    summary,
  });
};

export const updateExpense = async (req, res) => {
  const expense = await Expense.findById(req.params.id);

  if (!expense) {
    res.status(404);
    throw new Error('Expense not found');
  }

  try {
    const normalizedExpense = normalizeExpensePayload(req.body);
    expense.date = normalizedExpense.date;
    expense.expenseType = normalizedExpense.expenseType;
    expense.amount = normalizedExpense.amount;
    expense.notes = normalizedExpense.notes;

    const savedExpense = await expense.save();

    res.json({
      message: 'Expense updated successfully',
      expense: savedExpense,
    });
  } catch (error) {
    res.status(400);
    throw error;
  }
};

export const deleteExpense = async (req, res) => {
  const expense = await Expense.findById(req.params.id);

  if (!expense) {
    res.status(404);
    throw new Error('Expense not found');
  }

  await Expense.deleteOne({ _id: expense._id });

  res.json({ message: 'Expense deleted successfully' });
};