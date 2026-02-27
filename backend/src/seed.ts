import mongoose from "mongoose";
import { User } from "./models/User.ts";
import { MissingPersonRequest } from "./models/MissingPersonRequest.ts";

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/reunite";

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");

  // Clear existing data
  await User.deleteMany({});
  await MissingPersonRequest.deleteMany({});

  // Create users
  const citizenPassword = await Bun.password.hash("citizen123");
  const policePassword = await Bun.password.hash("police123");

  const citizen = await User.create({
    name: "Rahul Sharma",
    email: "citizen@reunite.com",
    password: citizenPassword,
    role: "CITIZEN",
  });

  const _police = await User.create({
    name: "Inspector Priya Singh",
    email: "police@reunite.com",
    password: policePassword,
    role: "POLICE",
  });

  // Create sample missing person requests
  await MissingPersonRequest.create([
    {
      reporterId: citizen._id.toString(),
      name: "Amit Kumar",
      gender: "Male",
      dateOfBirth: new Date("1990-05-15"),
      bloodGroup: "B+",
      lastKnownLocation: { latitude: 28.6139, longitude: 77.209 },
      photoUrl: "https://randomuser.me/api/portraits/men/1.jpg",
      status: "REPORTED",
    },
    {
      reporterId: citizen._id.toString(),
      name: "Priya Patel",
      gender: "Female",
      dateOfBirth: new Date("1985-12-01"),
      bloodGroup: "O+",
      lastKnownLocation: { latitude: 19.076, longitude: 72.8777 },
      photoUrl: "https://randomuser.me/api/portraits/women/2.jpg",
      status: "REPORTED",
    },
  ]);

  console.log("✓ Seed data created:");
  console.log("  Citizen: citizen@reunite.com / citizen123");
  console.log("  Police:  police@reunite.com / police123");
  console.log("  2 sample missing person requests created");

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
