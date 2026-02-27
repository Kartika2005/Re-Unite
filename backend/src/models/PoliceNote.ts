import mongoose, { Schema, type Document } from "mongoose";
import type { IPoliceNote } from "../types/index.ts";

export interface PoliceNoteDocument
  extends Omit<IPoliceNote, "_id">,
    Document {}

const PoliceNoteSchema = new Schema<PoliceNoteDocument>(
  {
    requestId: {
      type: String,
      ref: "MissingPersonRequest",
      required: true,
    },
    policeUserId: {
      type: String,
      ref: "User",
      required: true,
    },
    note: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const PoliceNote = mongoose.model<PoliceNoteDocument>(
  "PoliceNote",
  PoliceNoteSchema
);
