import mongoose, { Schema, type Document } from "mongoose";
import type { IScanResult } from "../types/index.ts";

export interface ScanResultDocument
  extends Omit<IScanResult, "_id">,
    Document {}

const ScanResultSchema = new Schema<ScanResultDocument>(
  {
    requestId: {
      type: String,
      ref: "MissingPersonRequest",
      required: true,
    },
    cctvId: { type: String, required: true },
    bestMatchImageUrl: { type: String, default: "" },
    confidenceScore: { type: Number, required: true },
    status: {
      type: String,
      enum: ["found", "not_found", "error"],
      required: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const ScanResult = mongoose.model<ScanResultDocument>(
  "ScanResult",
  ScanResultSchema
);
