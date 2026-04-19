import OfflineSale from '../models/OfflineSale.js';
import Order from '../models/Order.js';
import BatRepair from '../models/BatRepair.js';
import Expense from '../models/Expense.js';
import ExcelJS from 'exceljs';

const roundCurrency = (value) => Number(Number(value || 0).toFixed(2));

const getStartOfDay = (value) => {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const getEndOfDay = (value) => {
  const date = new Date(value);
  date.setUTCHours(23, 59, 59, 999);
  return date;
};

const normalizeRange = ({ from, to }) => {
  const today = new Date();
  const defaultTo = getEndOfDay(today);
  const defaultFrom = getStartOfDay(today);
  const fromDate = from ? getStartOfDay(from) : defaultFrom;
  const toDate = to ? getEndOfDay(to) : defaultTo;

  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return null;
  }

  return fromDate <= toDate
    ? { fromDate, toDate }
    : { fromDate: toDate, toDate: fromDate };
};

const getDateKey = (value) => getStartOfDay(value).toISOString().slice(0, 10);

const enumerateDateKeys = (fromDate, toDate) => {
  const keys = [];
  const cursor = new Date(fromDate);

  while (cursor <= toDate) {
    keys.push(getDateKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return keys;
};

const createEmptyDay = (date) => ({
  date,
  offlineSale: 0,
  onlineSale: 0,
  repairIncome: 0,
  expenses: 0,
  totalSale: 0,
  totalProfit: 0,
  status: '',
  offlineTransactions: 0,
  onlineTransactions: 0,
  repairTransactions: 0,
  totalQuantitySold: 0,
});


const INVALID_OFFLINE_PRODUCT_NAMES = new Set(['close', 'no sale', 'sunday']);

const normalizeOfflineProductName = (value = '') =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

const isFiniteNumber = (value) => Number.isFinite(Number(value));

const toNumeric = (value) => roundCurrency(Number(value || 0));

const formatExcelDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const isValidOfflineSalesRow = (entry) => {
  const productName = normalizeOfflineProductName(entry.productName);
  const quantity = Number(entry.quantitySold);
  const totalSale = Number(entry.totalSale);
  const totalCost = Number(entry.totalCost);

  return (
    productName &&
    !INVALID_OFFLINE_PRODUCT_NAMES.has(productName) &&
    isFiniteNumber(quantity) &&
    quantity > 0 &&
    isFiniteNumber(totalSale) &&
    isFiniteNumber(totalCost)
  );
};

const HOLIDAY_DAY_STATUSES = new Set(['Holiday', 'Closed', 'Sunday']);

// --- Build report data only from paid online orders ---
const buildReportData = async (query = {}) => {
  const normalizedRange = normalizeRange(query);
  if (!normalizedRange) return null;

  const { fromDate, toDate } = normalizedRange;
  const dateKeys = enumerateDateKeys(fromDate, toDate);
  const dayMap = new Map(dateKeys.map((date) => [date, createEmptyDay(date)]));

  // const onlineOrders = await Order.find({
  //   isPaid: true,
  //   paidAt: { $gte: fromDate, $lte: toDate },
  // })

   const [offlineSales, batRepairs, expenses, onlineOrders] = await Promise.all([
    OfflineSale.find({
      saleDate: { $gte: fromDate, $lte: toDate },
    }).sort({ saleDate: 1, createdAt: 1 }),
    BatRepair.find({
      date: { $gte: fromDate, $lte: toDate },
    }).sort({ date: 1, createdAt: 1 }),
    Expense.find({
      date: { $gte: fromDate, $lte: toDate },
    }).sort({ date: 1, createdAt: 1 }),
    Order.find({
      isPaid: true,
      paidAt: { $gte: fromDate, $lte: toDate },
    })
      .populate('orderItems.product', 'costPrice')
      .sort({ paidAt: 1, createdAt: 1 }),
  ]);
    
  const summary = {
    totalOfflineSale: 0,
    totalOnlineSale: 0,
    totalSalesAmount: 0,
    totalSalesProfit: 0,
    totalRepairIncome: 0,
    totalRepairCost: 0,
    totalRepairProfit: 0,
    totalExpenses: 0,
    netProfit: 0,
    noSaleDaysCount: 0,
    holidayDaysCount: 0,
    combinedTotalSale: 0,
    combinedTotalCost: 0,
    combinedTotalProfit: 0,
    totalTransactions: 0,
    totalQuantitySold: 0,
  };

   offlineSales.forEach((entry) => {
    const key = getDateKey(entry.saleDate);
    const day = dayMap.get(key) || createEmptyDay(key);

    if (entry.rowType === 'day_status' && entry.dayStatus) {
      day.status = entry.dayStatus;
    }

    if (!isValidOfflineSalesRow(entry)) {
      dayMap.set(key, day);
      return;
    }

    const entrySale = roundCurrency(Number(entry.totalSale));
    const entryCost = roundCurrency(Number(entry.totalCost));
    const entryProfit = roundCurrency(entrySale - entryCost);
    const entryQty = Number(entry.quantitySold);

    day.offlineSale = roundCurrency(day.offlineSale + entrySale);
    day.totalSale = roundCurrency(day.totalSale + entrySale);
    day.totalProfit = roundCurrency(day.totalProfit + entryProfit);
    day.offlineTransactions += 1;
    day.totalQuantitySold += entryQty;
    dayMap.set(key, day);

    summary.totalOfflineSale = roundCurrency(summary.totalOfflineSale + entrySale);
    summary.totalSalesAmount = roundCurrency(summary.totalSalesAmount + entrySale);
    summary.totalSalesProfit = roundCurrency(summary.totalSalesProfit + entryProfit);
    summary.combinedTotalSale = roundCurrency(summary.combinedTotalSale + entrySale);
    summary.combinedTotalCost = roundCurrency(summary.combinedTotalCost + entryCost);
    summary.combinedTotalProfit = roundCurrency(summary.combinedTotalProfit + entryProfit);
    summary.totalTransactions += 1;
    summary.totalQuantitySold += entryQty;
  });

  batRepairs.forEach((repair) => {
    const key = getDateKey(repair.date);
    const day = dayMap.get(key) || createEmptyDay(key);
    const repairIncome = roundCurrency(Number(repair.charge));
    const repairCost = roundCurrency(Number(repair.cost));
    const repairProfit = roundCurrency(Number(repair.profit));

    day.repairIncome = roundCurrency(day.repairIncome + repairIncome);
    day.totalSale = roundCurrency(day.totalSale + repairIncome);
    day.totalProfit = roundCurrency(day.totalProfit + repairProfit);
    day.repairTransactions += 1;
    dayMap.set(key, day);

    summary.totalRepairIncome = roundCurrency(summary.totalRepairIncome + repairIncome);
    summary.totalRepairCost = roundCurrency(summary.totalRepairCost + repairCost);
    summary.totalRepairProfit = roundCurrency(summary.totalRepairProfit + repairProfit);
    summary.combinedTotalSale = roundCurrency(summary.combinedTotalSale + repairIncome);
    summary.combinedTotalCost = roundCurrency(summary.combinedTotalCost + repairCost);
    summary.combinedTotalProfit = roundCurrency(summary.combinedTotalProfit + repairProfit);
    summary.totalTransactions += 1;
  });

  expenses.forEach((expense) => {
    const key = getDateKey(expense.date);
    const day = dayMap.get(key) || createEmptyDay(key);
    const amount = roundCurrency(Number(expense.amount));

    day.expenses = roundCurrency(day.expenses + amount);
    dayMap.set(key, day);

    summary.totalExpenses = roundCurrency(summary.totalExpenses + amount);
  });

  onlineOrders.forEach((order) => {
    const key = getDateKey(order.paidAt || order.createdAt);
    const day = dayMap.get(key) || createEmptyDay(key);

    const orderSale = roundCurrency(order.totalPrice);
    const orderQty = order.orderItems.reduce((sum, item) => sum + Number(item.qty || 0), 0);
    const orderCost = roundCurrency(
      order.orderItems.reduce(
        (sum, item) =>
          sum +
          (Number(item.costPrice ?? item.product?.costPrice ?? 0) * Number(item.qty || 0)),
        0
      )
    );
    const orderProfit = roundCurrency(orderSale - orderCost);

    day.onlineSale = roundCurrency(day.onlineSale + orderSale);
    day.totalSale = roundCurrency(day.totalSale + orderSale);
    day.totalProfit = roundCurrency(day.totalProfit + orderProfit);
    day.onlineTransactions += 1;
    day.totalQuantitySold += orderQty;
    dayMap.set(key, day);

    summary.totalOnlineSale = roundCurrency(summary.totalOnlineSale + orderSale);
    summary.totalSalesAmount = roundCurrency(summary.totalSalesAmount + orderSale);
    summary.totalSalesProfit = roundCurrency(summary.totalSalesProfit + orderProfit);
    summary.combinedTotalSale = roundCurrency(summary.combinedTotalSale + orderSale);
    summary.combinedTotalCost = roundCurrency(summary.combinedTotalCost + orderCost);
    summary.combinedTotalProfit = roundCurrency(summary.combinedTotalProfit + orderProfit);
    summary.totalTransactions += 1;
    summary.totalQuantitySold += orderQty;
  });

  const dailyBreakdown = dateKeys.map((date) => dayMap.get(date) || createEmptyDay(date));

  summary.noSaleDaysCount = dailyBreakdown.filter((day) => day.status === 'No Sale').length;
  summary.holidayDaysCount = dailyBreakdown.filter((day) =>
    HOLIDAY_DAY_STATUSES.has(day.status)
  ).length;
  summary.netProfit = roundCurrency(
    summary.totalSalesProfit + summary.totalRepairProfit - summary.totalExpenses
  );

  return {
    range: {
      from: getDateKey(fromDate),
      to: getDateKey(toDate),
    },
    summary,
    dailyBreakdown,
  };
};

// --- Exported controller functions ---
export const getSalesReport = async (req, res) => {
  const reportData = await buildReportData(req.query);
  if (!reportData) {
    res.status(400);
    throw new Error('Valid from/to dates are required');
  }
  res.json(reportData);
};

export const getBusinessSummary = async (req, res) => {
  const reportData = await buildReportData(req.query);
  if (!reportData) {
    res.status(400);
    throw new Error('Valid from/to dates are required');
  }
  res.json({ range: reportData.range, summary: reportData.summary });
};

export const exportSalesReport = async (req, res) => {
  const normalizedRange = normalizeRange({
    from: req.query.fromDate || req.query.from,
    to: req.query.toDate || req.query.to,
  });

  if (!normalizedRange) {
    res.status(400);
    throw new Error('Valid fromDate/toDate are required');
  }

  const { fromDate, toDate } = normalizedRange;

   const [offlineSales, onlineOrders] = await Promise.all([
    OfflineSale.find({
      saleDate: { $gte: fromDate, $lte: toDate },
    }).sort({ saleDate: 1, createdAt: 1 }),
    Order.find({
      isPaid: true,
      createdAt: { $gte: fromDate, $lte: toDate },
    })
      .populate('orderItems.product', 'costPrice')
      .populate('user', 'name')
      .sort({ createdAt: 1, paidAt: 1 }),
  ]);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sales Report');

  worksheet.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Type', key: 'type', width: 12 },
    { header: 'Product Name', key: 'productName', width: 32 },
    { header: 'Variant', key: 'variantName', width: 24 },
    { header: 'Quantity', key: 'quantity', width: 12 },
    { header: 'Sale Price', key: 'salePrice', width: 14 },
    { header: 'Total Sale', key: 'totalSale', width: 14 },
    { header: 'Cost Price', key: 'costPrice', width: 14 },
    { header: 'Total Cost', key: 'totalCost', width: 14 },
    { header: 'Profit', key: 'profit', width: 14 },
    { header: 'Payment Mode', key: 'paymentMode', width: 18 },
    { header: 'Customer Name', key: 'customerName', width: 24 },
  ];

  const offlineRows = offlineSales
    .filter((entry) => isValidOfflineSalesRow(entry))
    .map((entry) => ({
      date: formatExcelDate(entry.saleDate),
      type: 'Offline',
      productName: entry.productName || '-',
      variantName: entry.variantName || '-',
      quantity: toNumeric(entry.quantitySold),
      salePrice: toNumeric(entry.salePricePerItem),
      totalSale: toNumeric(entry.totalSale),
      costPrice: toNumeric(entry.costPricePerItem),
      totalCost: toNumeric(entry.totalCost),
      profit: toNumeric(entry.profit || toNumeric(entry.totalSale) - toNumeric(entry.totalCost)),
      paymentMode: entry.paymentMode || '-',
      pendingAmount: toNumeric(entry.pendingAmount),
      customerName: entry.customerName || '-',
    }));

  const onlineRows = onlineOrders.flatMap((order) => {
    const customerName = order.user?.name || '-';
    const paymentMode = order.paymentMethod || 'Online';

    return order.orderItems.map((item) => {
      const quantity = toNumeric(item.qty);
      const salePrice = toNumeric(item.price);
      const totalSale = roundCurrency(quantity * salePrice);
      const costPrice = toNumeric(item.costPrice ?? item.product?.costPrice);
      const totalCost = roundCurrency(quantity * costPrice);
      const profit = roundCurrency(totalSale - totalCost);

      return {
        date: formatExcelDate(order.paidAt || order.createdAt),
        type: 'Online',
        productName: item.name || '-',
        variantName: item.variantName || '-',
        quantity,
        salePrice,
        totalSale,
        costPrice,
        totalCost,
        profit,
        paymentMode,
        customerName,
      };
    });
  });

[...offlineRows, ...onlineRows]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .forEach((row) => worksheet.addRow(row));

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFB91C1C' },
  };
  headerRow.border = {
    bottom: { style: 'thin', color: { argb: '33FFFFFF' } },
  };

  worksheet.eachRow((row, rowNumber) => {
    row.alignment = { vertical: 'middle' };

    if (rowNumber === 1) {
      return;
    }

    row.eachCell((cell, colNumber) => {
      if ([4, 5, 6, 7, 8, 9, 11].includes(colNumber)) {
        cell.numFmt = '#,##0.00';
      }

      cell.border = {
        bottom: { style: 'thin', color: { argb: '14CBD5E1' } },
      };
    });
  });

  res.setHeader(
    'Content-Disposition',
    'attachment; filename=sales-report.xlsx'
  );
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );

  await workbook.xlsx.write(res);
  res.end();
};