import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function randomDigits(length: number) {
  let digits = "";

  while (digits.length < length) {
    digits += Math.floor(Math.random() * 10).toString();
  }

  return digits.slice(0, length);
}

export interface TestFixture {
  organizationId: string;
  plantId: string;
  plantToken: string;
  plantWifiSsid: string;
  plantWifiBssid: string;
  plantWifiCidr: string;
  userId: string;
  userEmail: string;
  userPassword: string;
  employeeId: string;
  employeeCpf: string;
}

export async function createFixture(): Promise<TestFixture> {
  const suffix = randomUUID().slice(0, 8);
  const organization = await prisma.organization.create({
    data: {
      code: `test-${suffix}`,
      name: `Organization ${suffix}`,
    },
  });

  const plantWifiSsid = `SSID-${suffix}`;
  const plantWifiBssid = `AA:BB:CC:${suffix.slice(0, 2)}:${suffix.slice(2, 4)}:${suffix.slice(4, 6)}`;
  const plantWifiCidr = "10.10.0.0/24";

  const plant = await prisma.plant.create({
    data: {
      organizationId: organization.id,
      code: `plant-${suffix}`,
      name: `Plant ${suffix}`,
      city: "Petrolina",
      state: "PE",
      openingHour: "06:00",
      closingHour: "18:00",
      qrToken: `qr-${suffix}`,
      authorizedNetworks: {
        create: {
          name: `Network ${suffix}`,
          ssid: plantWifiSsid,
          bssid: plantWifiBssid,
          ipv4Cidr: plantWifiCidr,
        },
      },
    },
  });

  const userPassword = "Passw0rd!123";
  const passwordHash = await bcrypt.hash(userPassword, 12);
  const user = await prisma.user.create({
    data: {
      organizationId: organization.id,
      plantId: plant.id,
      name: `Admin ${suffix}`,
      email: `admin.${suffix}@example.com`,
      emailVerified: true,
      image: null,
      passwordHash,
      role: "SUPER_ADMIN",
      accounts: {
        create: {
          id: randomUUID(),
          accountId: `credential-${suffix}`,
          providerId: "credential",
          password: passwordHash,
        },
      },
    },
  });

  const employee = await prisma.employee.create({
    data: {
      organizationId: organization.id,
      primaryPlantId: plant.id,
      fullName: `Employee ${suffix}`,
      cpf: randomDigits(11),
      employer: "Solar Service",
      jobTitle: "Field Technician",
    },
  });

  return {
    organizationId: organization.id,
    plantId: plant.id,
    plantToken: plant.qrToken,
    plantWifiSsid,
    plantWifiBssid,
    plantWifiCidr,
    userId: user.id,
    userEmail: user.email,
    userPassword,
    employeeId: employee.id,
    employeeCpf: employee.cpf,
  };
}

export async function cleanupFixture(fixture: TestFixture) {
  await prisma.organization.delete({
    where: { id: fixture.organizationId },
  });
}

export async function cleanupDanglingFixtures() {
  await prisma.organization.deleteMany({
    where: {
      code: {
        startsWith: "test-",
      },
    },
  });
}

export async function prismaDisconnect() {
  await prisma.$disconnect();
}

export { prisma };
