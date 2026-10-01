import mongoose from "mongoose";
import { connectDb } from "@/lib/db/mongoose";
import { apiRoute } from "@/lib/utils/http";

export const GET = apiRoute({ public: true }, async () => {
  await connectDb();
  await mongoose.connection.db?.admin().ping();
  return { ok: true, db: "up" };
});
