import mongoose, { Schema, type Document } from "mongoose";
import type { IUser } from "../types/index.ts";

export interface UserDocument extends Omit<IUser, "_id">, Document {}

const UserSchema = new Schema<UserDocument>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["CITIZEN", "POLICE"], required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const User = mongoose.model<UserDocument>("User", UserSchema);
