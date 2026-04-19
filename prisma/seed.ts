import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = "admin@biblioteca.edu";
  const password = "admin123";

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin user already exists: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.adminUser.create({
    data: {
      email,
      passwordHash,
      name: "Administrador",
    },
  });

  console.log(`Admin user created: ${email} / ${password}`);
  console.log("IMPORTANT: Change this password in production!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
