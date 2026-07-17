import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const isHosted =
  /supabase\.(co|com)/.test(connectionString) ||
  connectionString.includes("sslmode=require");

const adapter = new PrismaPg({
  connectionString,
  ...(isHosted ? { ssl: { rejectUnauthorized: false } } : {}),
});

export const prisma = new PrismaClient({ adapter });
