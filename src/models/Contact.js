import mongoose from "mongoose";

const contactSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
    },
    phone: {
      type: String,
      default: "",
    },
    subject: {
      type: String,
      enum: [
        "General Inquiry",
        "Order Status Support",
        "Returns & Exchanges",
        "Product Sizing Advice",
        "Bulk/Team Orders",
        "Bulk / Team Orders",
      ],
      default: "General Inquiry",
    },
    message: {
      type: String,
      required: true,
    },

    // Admin panel ke liye useful fields
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Contact", contactSchema);