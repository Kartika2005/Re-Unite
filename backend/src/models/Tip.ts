import mongoose, { Schema, type Document } from "mongoose";
import type { ITip } from "../types/index.ts";

export interface TipDocument extends Omit<ITip, "_id">, Document {}

const TipSchema = new Schema<TipDocument>(
  {
    requestId: {
      type: String,
      ref: "MissingPersonRequest",
      required: true,
    },
    message: { type: String, required: true },
    location: {
      latitude: { type: Number },
      longitude: { type: Number },
    },
    contactInfo: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Tip = mongoose.model<TipDocument>("Tip", TipSchema);
