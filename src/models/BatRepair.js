import mongoose from 'mongoose';

const batRepairSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },
    customerName: {
      type: String,
      trim: true,
      default: '',
    },
    repairType: {
      type: String,
      enum: ['Binding', 'Handle', 'Full Repair'],
      required: true,
    },
    charge: {
      type: Number,
      required: true,
      min: 0,
    },
    cost: {
      type: Number,
      required: true,
      min: 0,
    },
    profit: {
      type: Number,
      required: true,
      default: 0,
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

const BatRepair = mongoose.model('BatRepair', batRepairSchema);

export default BatRepair;