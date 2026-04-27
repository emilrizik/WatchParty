import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting seed...");

  // Create test admin user (required for testing)
  const testPassword = await bcrypt.hash("johndoe123", 10);
  
  const testUser = await prisma.user.upsert({
    where: { email: "john@doe.com" },
    update: { isAdmin: true },
    create: {
      email: "john@doe.com",
      password: testPassword,
      name: "John Doe",
      isAdmin: true,
    },
  });

  console.log("Test admin user created:", testUser.email);

  // Create admin user rizik
  const adminPassword = await bcrypt.hash("rizik", 10);
  
  const adminUser = await prisma.user.upsert({
    where: { email: "rizik@admin.com" },
    update: { isAdmin: true },
    create: {
      email: "rizik@admin.com",
      password: adminPassword,
      name: "Rizik",
      isAdmin: true,
    },
  });

  console.log("Admin user created:", adminUser.email);

  // Create categories
  const categories = [
    { name: "Películas", slug: "peliculas" },
    { name: "Series", slug: "series" },
    { name: "Documentales", slug: "documentales" },
    { name: "Música", slug: "musica" },
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {},
      create: category,
    });
    console.log(`Category created: ${category.name}`);
  }

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("Error seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
