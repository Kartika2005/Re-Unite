import mongoose, { Schema, type Document } from "mongoose";
import type { IDuplicateAlert } from "../types/index.ts";

export interface DuplicateAlertDocument
  extends Omit<IDuplicateAlert, "_id">,
    Document {}

const DuplicateAlertSchema = new Schema<DuplicateAlertDocument>(
  {
    newRequestId: {
      type: String,
      ref: "MissingPersonRequest",
      required: true,
    },
    existingRequestId: {
      type: String,
      ref: "MissingPersonRequest",
      required: true,
    },
    score: { type: Number, required: true },
    matchType: {
      type: String,
      enum: ["FACE", "AADHAAR", "BOTH"],
      required: true,
    },
    severity: {
      type: String,
      enum: ["CRITICAL", "HIGH", "MEDIUM"],
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "DISMISSED", "LINKED"],
      default: "PENDING",
      required: true,
    },
  },
  { timestamps: true }
);

// Index for fast lookups
DuplicateAlertSchema.index({ newRequestId: 1 });
DuplicateAlertSchema.index({ existingRequestId: 1 });
DuplicateAlertSchema.index({ status: 1, severity: 1 });

export const DuplicateAlert = mongoose.model<DuplicateAlertDocument>(
  "DuplicateAlert",
  DuplicateAlertSchema
);
