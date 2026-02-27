import mongoose, { Schema, type Document } from "mongoose";
import type { IMissingPersonRequest } from "../types/index.ts";

export interface MissingPersonRequestDocument
  extends Omit<IMissingPersonRequest, "_id">,
    Document {}

const MissingPersonRequestSchema = new Schema<MissingPersonRequestDocument>(
  {
    reporterId: {
      type: String,
      ref: "User",
      required: true,
    },
    name: { type: String },
    gender: { type: String },
    dateOfBirth: { type: Date },
    bloodGroup: { type: String, required: true },
    lastKnownLocation: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },
    photoUrl: { type: String, required: true },
    status: {
      type: String,
      enum: [
        "REPORTED",
        "UNDER_REVIEW",
        "SCANNING",
        "FOUND",
        "DECLINED",
        "DISCARDED",
      ],
      default: "REPORTED",
      required: true,
    },
    aadhaarNo: { type: String },
    phoneNumber: { type: String },
    address: { type: String },
    faceEmbedding: { type: [Number], select: false },
    bountyAmount: { type: Number, default: 0 },
    bountyStatus: {
      type: String,
      enum: [
        "NONE",
        "PLEDGED",
        "PAYMENT_PENDING",
        "PAYMENT_INITIATED",
        "PAYMENT_COMPLETED",
        "PAYMENT_FAILED",
        "RELEASED_TO_TIPPER",
        "CANCELLED",
      ],
      default: "NONE",
    },
  },
  { timestamps: true }
);

export const MissingPersonRequest =
  mongoose.model<MissingPersonRequestDocument>(
    "MissingPersonRequest",
    MissingPersonRequestSchema
  );
