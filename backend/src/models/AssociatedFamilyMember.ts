import mongoose, { Schema, type Document } from "mongoose";
import type { IAssociatedFamilyMember } from "../types/index.ts";

export interface AssociatedFamilyMemberDocument
  extends Omit<IAssociatedFamilyMember, "_id">, Document {}

const AssociatedFamilyMemberSchema = new Schema<AssociatedFamilyMemberDocument>(
  {
    citizenId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    fullName: { type: String, required: true, trim: true },
    relation: { type: String, required: true, trim: true },
    gender: { type: String, trim: true },
    dateOfBirth: { type: Date },
    bloodGroup: { type: String, trim: true },
    emergencyContact: { type: String, trim: true },
    rfidTagId: { type: String, required: true, trim: true, unique: true },
    notes: { type: String, trim: true },
  },
  {
    timestamps: true,
    collection: "associated_family_members",
  },
);

export const AssociatedFamilyMember =
  mongoose.model<AssociatedFamilyMemberDocument>(
    "AssociatedFamilyMember",
    AssociatedFamilyMemberSchema,
  );
