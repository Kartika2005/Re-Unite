import mongoose, { Schema, type Document } from "mongoose";
import type { ICaseEvent } from "../types/index.ts";

export interface CaseEventDocument extends Omit<ICaseEvent, "_id">, Document {}

const CaseEventSchema = new Schema<CaseEventDocument>(
  {
    requestId: {
      type: String,
      ref: "MissingPersonRequest",
      required: true,
      index: true,
    },
    action: { type: String, required: true },
    actor: { type: String },
    details: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const CaseEvent = mongoose.model<CaseEventDocument>(
  "CaseEvent",
  CaseEventSchema
);
