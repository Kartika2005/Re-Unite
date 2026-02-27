import mongoose, { Schema, type Document } from "mongoose";

export type BountyStatus =
  | "PLEDGED"
  | "PAYMENT_PENDING"
  | "PAYMENT_INITIATED"
  | "PAYMENT_COMPLETED"
  | "PAYMENT_FAILED"
  | "RELEASED_TO_TIPPER"
  | "CANCELLED";

export interface IBountyTransaction {
  _id: string;
  requestId: string;
  reporterId: string;
  amount: number;
  status: BountyStatus;
  merchantOrderId?: string;
  phonepeOrderId?: string;
  transactionId?: string;
  /** Tip _id of the tipper who should receive the reward (set by police) */
  awardedTipId?: string;
  /** Contact info of the tipper who will receive the reward */
  awardedTipperContact?: string;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface BountyTransactionDocument
  extends Omit<IBountyTransaction, "_id">,
    Document {}

const BountyTransactionSchema = new Schema<BountyTransactionDocument>(
  {
    requestId: {
      type: String,
      ref: "MissingPersonRequest",
      required: true,
    },
    reporterId: {
      type: String,
      ref: "User",
      required: true,
    },
    amount: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: [
        "PLEDGED",
        "PAYMENT_PENDING",
        "PAYMENT_INITIATED",
        "PAYMENT_COMPLETED",
        "PAYMENT_FAILED",
        "RELEASED_TO_TIPPER",
        "CANCELLED",
      ],
      default: "PLEDGED",
      required: true,
    },
    merchantOrderId: { type: String },
    phonepeOrderId: { type: String },
    transactionId: { type: String },
    awardedTipId: { type: String },
    awardedTipperContact: { type: String },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

// Index: only one bounty per case
BountyTransactionSchema.index({ requestId: 1 }, { unique: true });

export const BountyTransaction =
  mongoose.model<BountyTransactionDocument>(
    "BountyTransaction",
    BountyTransactionSchema
  );
