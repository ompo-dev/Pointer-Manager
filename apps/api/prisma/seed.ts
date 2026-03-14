import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const seededUsers = [
  {
    name: "Super Admin Cliente Solar",
    email: "super.admin@cliente-solar.com",
    password: "Pm!SuperAdmin2026",
    role: "SUPER_ADMIN" as const,
    plantScoped: false,
  },
  {
    name: "Administrador Operacional",
    email: "admin@cliente-solar.com",
    password: "Pm!Admin2026",
    role: "ADMIN" as const,
    plantScoped: false,
  },
  {
    name: "Supervisor Usina Norte 01",
    email: "supervisor.norte01@cliente-solar.com",
    password: "Pm!Supervisor2026",
    role: "PLANT_SUPERVISOR" as const,
    plantScoped: true,
  },
];

async function main() {
  const organization = await prisma.organization.upsert({
    where: { code: "solar-client" },
    update: {},
    create: {
      code: "solar-client",
      name: "Cliente Solar",
    },
  });

  const plant = await prisma.plant.upsert({
    where: { code: "usina-norte-01" },
    update: {},
    create: {
      organizationId: organization.id,
      code: "usina-norte-01",
      name: "Usina Norte 01",
      city: "Petrolina",
      state: "PE",
      openingHour: "06:00",
      closingHour: "18:00",
      qrToken: "usina-norte-01-token",
      authorizedNetworks: {
        create: {
          name: "Wi-Fi Operação",
          ssid: "USINA_NORTE_01",
          ipv4Cidr: "192.168.0.0/24",
        },
      },
    },
  });

  for (const seededUser of seededUsers) {
    const passwordHash = await bcrypt.hash(seededUser.password, 12);

    const user = await prisma.user.upsert({
      where: { email: seededUser.email },
      update: {
        organizationId: organization.id,
        plantId: seededUser.plantScoped ? plant.id : null,
        name: seededUser.name,
        emailVerified: true,
        image: null,
        role: seededUser.role,
        status: "ACTIVE",
      },
      create: {
        organizationId: organization.id,
        plantId: seededUser.plantScoped ? plant.id : null,
        name: seededUser.name,
        email: seededUser.email,
        emailVerified: true,
        image: null,
        passwordHash,
        role: seededUser.role,
        status: "ACTIVE",
      },
    });

    await prisma.account.upsert({
      where: {
        providerId_accountId: {
          providerId: "credential",
          accountId: user.id,
        },
      },
      update: {
        userId: user.id,
        password: passwordHash,
      },
      create: {
        id: crypto.randomUUID(),
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: passwordHash,
      },
    });
  }

  await prisma.employee.upsert({
    where: { cpf: "12345678901" },
    update: {},
    create: {
      organizationId: organization.id,
      primaryPlantId: plant.id,
      fullName: "João da Usina",
      cpf: "12345678901",
      employer: "Solar Service",
      jobTitle: "Eletricista",
    },
  });

  console.table(
    seededUsers.map((user) => ({
      role: user.role,
      email: user.email,
      password: user.password,
    })),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
