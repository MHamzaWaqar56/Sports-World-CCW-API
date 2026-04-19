import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },
    expenseType: {
      type: String,
      enum: ['Petrol', 'Food', 'Electricity Bill', 'Rent', 'Courier', 'Packing', 'Other'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
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

const Expense = mongoose.model('Expense', expenseSchema);

export default Expense;