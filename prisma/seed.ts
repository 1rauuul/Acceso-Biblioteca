import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function loadSeedCredentials():
  | { email: string; password: string; name: string }
  | null {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME?.trim() || "Administrador";

  if (!email || !password) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(
      "SEED_ADMIN_EMAIL is set but is not a valid email address"
    );
  }
  if (password.length < 8) {
    throw new Error(
      "SEED_ADMIN_PASSWORD must be at least 8 characters long"
    );
  }
  return { email, password, name };
}

async function main() {
  const isProd = process.env.NODE_ENV === "production";
  const creds = loadSeedCredentials();

  if (!creds) {
    if (isProd) {
      throw new Error(
        "Refusing to seed admin in production without SEED_ADMIN_EMAIL and " +
          "SEED_ADMIN_PASSWORD environment variables. Set both before running " +
          "`prisma db seed` to provision the initial administrator."
      );
    }
    console.warn(
      "[seed] Skipping admin user creation: SEED_ADMIN_EMAIL and " +
        "SEED_ADMIN_PASSWORD are not set. The admin panel will be " +
        "inaccessible until at least one admin is created."
    );
    return;
  }

  const existing = await prisma.adminUser.findUnique({
    where: { email: creds.email },
  });
  if (existing) {
    console.log(`Admin user already exists: ${creds.email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(creds.password, 10);
  await prisma.adminUser.create({
    data: {
      email: creds.email,
      passwordHash,
      name: creds.name,
    },
  });

  console.log(`Admin user created: ${creds.email}`);
  console.log(
    "The password was read from the SEED_ADMIN_PASSWORD env var and is " +
      "NOT printed to the logs. Change it from /admin/cuenta before exposing " +
      "the app."
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
