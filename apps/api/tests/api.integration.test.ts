import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { app } from "../src/app";
import {
  cleanupDanglingFixtures,
  cleanupFixture,
  createFixture,
  prisma,
  prismaDisconnect,
  type TestFixture,
} from "./helpers/test-fixtures";

async function requestJson(
  path: string,
  init?: Omit<RequestInit, "body"> & { token?: string; body?: unknown },
) {
  const headers = new Headers(init?.headers);

  if (init?.token) {
    headers.set("authorization", `Bearer ${init.token}`);
  }

  if (init?.body !== undefined) {
    headers.set("content-type", "application/json");
  }

  const response = await app.handle(
    new Request(`http://localhost${path}`, {
      ...init,
      headers,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    }),
  );

  return {
    response,
    json: (await response.json()) as any,
  };
}

async function login(fixture: TestFixture) {
  const { response, json } = await requestJson("/api/v1/auth/login", {
    method: "POST",
    body: {
      email: fixture.userEmail,
      password: fixture.userPassword,
    },
  });

  expect(response.status).toBe(200);
  expect(json.user.email).toBe(fixture.userEmail);

  return json.token as string;
}

function randomCpf(prefix = "9") {
  const suffix = Math.floor(Math.random() * 10_000_000_000)
    .toString()
    .padStart(10, "0");

  return `${prefix}${suffix}`.slice(0, 11);
}

beforeAll(async () => {
  await cleanupDanglingFixtures();
});

afterAll(async () => {
  await cleanupDanglingFixtures();
  await prismaDisconnect();
});

describe("api integration", () => {
  it("returns health status", async () => {
    const response = await app.handle(new Request("http://localhost/api/v1/health"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      service: "point-manager-api",
    });
  });

  it("authenticates and resolves the current user", async () => {
    const fixture = await createFixture();

    try {
      const token = await login(fixture);
      const { response, json } = await requestJson("/api/v1/auth/me", {
        method: "GET",
        token,
      });

      expect(response.status).toBe(200);
      expect(json.email).toBe(fixture.userEmail);
      expect(json.organizationId).toBe(fixture.organizationId);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("rejects invalid credentials", async () => {
    const fixture = await createFixture();

    try {
      const { response, json } = await requestJson("/api/v1/auth/login", {
        method: "POST",
        body: {
          email: fixture.userEmail,
          password: "wrong-pass",
        },
      });

      expect(response.status).toBe(401);
      expect(json).toEqual({
        message: "Credenciais invalidas.",
      });
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("lists plants and people for the authenticated organization", async () => {
    const fixture = await createFixture();

    try {
      const token = await login(fixture);

      const plantsResult = await requestJson("/api/v1/plants", {
        method: "GET",
        token,
      });
      const peopleResult = await requestJson("/api/v1/people", {
        method: "GET",
        token,
      });

      expect(plantsResult.response.status).toBe(200);
      expect(plantsResult.json).toHaveLength(1);
      expect(plantsResult.json[0].authorizedNetworks).toHaveLength(1);

      expect(peopleResult.response.status).toBe(200);
      expect(peopleResult.json).toHaveLength(1);
      expect(peopleResult.json[0].cpf).toBe(fixture.personCpf);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it(
    "executes the full time-entry flow, persists audit logs and realtime events",
    async () => {
      const fixture = await createFixture();

      try {
        const token = await login(fixture);

        const entryResult = await requestJson("/api/v1/time-entries/entry", {
          method: "POST",
          body: {
            cpf: fixture.personCpf,
            plantId: fixture.plantId,
            deviceIp: "10.10.0.12",
            deviceLabel: "Chrome on Android",
            networkEffectiveType: "4g",
            wifiSsid: fixture.plantWifiSsid,
            wifiBssid: fixture.plantWifiBssid,
            selfieUrl: "https://example.com/selfie.jpg",
          },
        });

        expect(entryResult.response.status).toBe(200);
        expect(entryResult.json.status).toBe("OPEN");

        const duplicateEntryResult = await requestJson("/api/v1/time-entries/entry", {
          method: "POST",
          body: {
            cpf: fixture.personCpf,
            plantId: fixture.plantId,
            deviceIp: "10.10.0.12",
            wifiSsid: fixture.plantWifiSsid,
            wifiBssid: fixture.plantWifiBssid,
            selfieUrl: "https://example.com/selfie.jpg",
          },
        });

        expect(duplicateEntryResult.response.status).toBe(409);
        expect(duplicateEntryResult.json).toEqual({
          message: "Ja existe um acesso em aberto para esta pessoa.",
        });

        const liveEntriesResult = await requestJson("/api/v1/time-entries/live", {
          method: "GET",
          token,
        });

        expect(liveEntriesResult.response.status).toBe(200);
        expect(liveEntriesResult.json).toHaveLength(1);
        expect(liveEntriesResult.json[0].person.cpf).toBe(fixture.personCpf);

        const exitResult = await requestJson("/api/v1/time-entries/exit", {
          method: "POST",
          body: {
            cpf: fixture.personCpf,
            plantId: fixture.plantId,
            deviceIp: "10.10.0.12",
            wifiSsid: fixture.plantWifiSsid,
            wifiBssid: fixture.plantWifiBssid,
            selfieUrl: "https://example.com/selfie.jpg",
          },
        });

        expect(exitResult.response.status).toBe(200);
        expect(exitResult.json.status).toBe("CLOSED");
        expect(typeof exitResult.json.totalMinutes).toBe("number");

        const auditActions = await prisma.auditLog.findMany({
          where: {
            organizationId: fixture.organizationId,
          },
          select: {
            action: true,
          },
        });

        expect(auditActions.map((item) => item.action)).toContain("TIME_ENTRY.OPENED");
        expect(auditActions.map((item) => item.action)).toContain("TIME_ENTRY.CLOSED");

        const realtimeEvents = await prisma.realtimeEvent.findMany({
          where: {
            organizationId: fixture.organizationId,
          },
          orderBy: {
            createdAt: "asc",
          },
        });

        expect(realtimeEvents.map((item) => item.type)).toEqual([
          "entry.created",
          "entry.closed",
        ]);
      } finally {
        await cleanupFixture(fixture);
      }
    },
    15000,
  );

  it("builds the public intake context and suggests exit for an open access in the same plant", async () => {
    const fixture = await createFixture();

    try {
      const initialIntake = await requestJson("/api/v1/time-entries/intake", {
        method: "POST",
        body: {
          cpf: `${fixture.personCpf.slice(0, 3)}.${fixture.personCpf.slice(3, 6)}.${fixture.personCpf.slice(6, 9)}-${fixture.personCpf.slice(9)}`,
          plantId: fixture.plantId,
        },
      });

      expect(initialIntake.response.status).toBe(200);
      expect(initialIntake.json.person.fullName).toBeDefined();
      expect(initialIntake.json.suggestedMode).toBe("ENTRY");
      expect(initialIntake.json.personTypePolicies.length).toBeGreaterThan(0);

      const entryResult = await requestJson("/api/v1/time-entries/entry", {
        method: "POST",
        body: {
          cpf: fixture.personCpf,
          plantId: fixture.plantId,
          deviceIp: "10.10.0.12",
          wifiSsid: fixture.plantWifiSsid,
          wifiBssid: fixture.plantWifiBssid,
        },
      });

      expect(entryResult.response.status).toBe(200);

      const exitIntake = await requestJson("/api/v1/time-entries/intake", {
        method: "POST",
        body: {
          cpf: fixture.personCpf,
          plantId: fixture.plantId,
        },
      });

      expect(exitIntake.response.status).toBe(200);
      expect(exitIntake.json.suggestedMode).toBe("EXIT");
      expect(exitIntake.json.openEntry.samePlant).toBe(true);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("does not block a matching authorized network when the browser reports a false mobile hint", async () => {
    const fixture = await createFixture();
    const ethernetLikeIp = fixture.plantLocalCidr.replace(".0/24", ".42");

    try {
      const entryResult = await requestJson("/api/v1/time-entries/entry", {
        method: "POST",
        body: {
          cpf: fixture.personCpf,
          plantId: fixture.plantId,
          deviceIp: ethernetLikeIp,
          networkType: "cellular",
          networkEffectiveType: "4g",
        },
      });

      expect(entryResult.response.status).toBe(200);
      expect(entryResult.json.validationNotes).toContain("LAN local da usina");
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("validates the public flow with the real request IP and exposes the network status", async () => {
    const fixture = await createFixture();

    try {
      const networkStatusResult = await requestJson("/api/v1/time-entries/network-status", {
        method: "POST",
        headers: {
          "x-real-ip": fixture.plantPublicIp,
        },
        body: {
          plantId: fixture.plantId,
        },
      });

      expect(networkStatusResult.response.status).toBe(200);
      expect(networkStatusResult.json.network.status).toBe("AUTHORIZED");
      expect(networkStatusResult.json.network.matchedNetworkName).toBeDefined();
      expect(networkStatusResult.json.network.currentNetworkName).toBeDefined();
      expect(networkStatusResult.json.network.observedPublicIp).toBe(fixture.plantPublicIp);
      expect(networkStatusResult.json.network.matchedBy).toBe("public-ip");
      expect(networkStatusResult.json.location.status).toBe("OPEN");

      const entryResult = await requestJson("/api/v1/time-entries/entry", {
        method: "POST",
        headers: {
          "x-real-ip": fixture.plantPublicIp,
        },
        body: {
          cpf: fixture.personCpf,
          plantId: fixture.plantId,
        },
      });

      expect(entryResult.response.status).toBe(200);
      expect(entryResult.json.deviceIp).toBe(fixture.plantPublicIp);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("requires the plant id on network-status and resolves the environment by plant", async () => {
    const fixture = await createFixture();

    try {
      const networkStatusResult = await requestJson("/api/v1/time-entries/network-status", {
        method: "POST",
        body: {
          plantId: fixture.plantId,
          browserIpCandidates: ["10.10.0.42"],
          networkType: "wifi",
        },
      });

      expect(networkStatusResult.response.status).toBe(200);
      expect(networkStatusResult.json.plant.id).toBe(fixture.plantId);
      expect(networkStatusResult.json.network.status).toBe("AUTHORIZED");
      expect(networkStatusResult.json.network.observedLocalIp).toBe("10.10.0.42");
      expect(networkStatusResult.json.network.matchedBy).toBe("local-cidr");
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("resolves the legacy public token route for QR links antigos", async () => {
    const fixture = await createFixture();

    try {
      const publicPlantResult = await requestJson(
        `/api/v1/plants/public/token/${fixture.plantToken}`,
        {
          method: "GET",
        },
      );

      expect(publicPlantResult.response.status).toBe(200);
      expect(publicPlantResult.json.id).toBe(fixture.plantId);
      expect(publicPlantResult.json.qrToken).toBe(fixture.plantToken);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("distinguishes wired and wifi labels but authorizes both when they share the same subnet", async () => {
    const fixture = await createFixture();

    try {
      const networkStatusResult = await requestJson("/api/v1/time-entries/network-status", {
        method: "POST",
        body: {
          plantId: fixture.plantId,
          browserIpCandidates: ["10.10.0.77"],
          networkType: "ethernet",
        },
      });

      expect(networkStatusResult.response.status).toBe(200);
      expect(networkStatusResult.json.network.status).toBe("AUTHORIZED");
      expect(networkStatusResult.json.network.matchedBy).toBe("local-cidr");
      expect(networkStatusResult.json.network.currentNetworkName).toContain("Rede cabeada");
      expect(networkStatusResult.json.network.matchedNetworkName).toBeDefined();
      expect(networkStatusResult.json.network.message).toContain("LAN local");
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("evaluates geolocation readiness before the CPF step on the public register flow", async () => {
    const fixture = await createFixture();

    try {
      await prisma.plant.update({
        where: { id: fixture.plantId },
        data: {
          geofenceLatitude: -9.391609,
          geofenceLongitude: -40.502335,
          geofenceRadiusMeters: 300,
        },
      });

      const pendingLocationResult = await requestJson("/api/v1/time-entries/network-status", {
        method: "POST",
        headers: {
          "x-real-ip": fixture.plantPublicIp,
        },
        body: {
          plantId: fixture.plantId,
        },
      });

      expect(pendingLocationResult.response.status).toBe(200);
      expect(pendingLocationResult.json.location.status).toBe("PENDING");
      expect(pendingLocationResult.json.ready).toBe(false);

      const authorizedLocationResult = await requestJson("/api/v1/time-entries/network-status", {
        method: "POST",
        headers: {
          "x-real-ip": fixture.plantPublicIp,
        },
        body: {
          plantId: fixture.plantId,
          geoLatitude: -9.3917,
          geoLongitude: -40.5024,
        },
      });

      expect(authorizedLocationResult.response.status).toBe(200);
      expect(authorizedLocationResult.json.location.status).toBe("AUTHORIZED");
      expect(authorizedLocationResult.json.ready).toBe(true);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("resolves the real local network from browser IP candidates when the request arrives as localhost", async () => {
    const fixture = await createFixture();

    try {
      const networkStatusResult = await requestJson("/api/v1/time-entries/network-status", {
        method: "POST",
        body: {
          plantId: fixture.plantId,
          browserIpCandidates: ["10.10.0.42"],
          networkType: "wifi",
        },
      });

      expect(networkStatusResult.response.status).toBe(200);
      expect(networkStatusResult.json.network.status).toBe("AUTHORIZED");
      expect(networkStatusResult.json.network.observedLocalIp).toBe("10.10.0.42");
      expect(networkStatusResult.json.network.matchedBy).toBe("local-cidr");

      const entryResult = await requestJson("/api/v1/time-entries/entry", {
        method: "POST",
        body: {
          cpf: fixture.personCpf,
          plantId: fixture.plantId,
          browserIpCandidates: ["10.10.0.42"],
          networkType: "wifi",
        },
      });

      expect(entryResult.response.status).toBe(200);
      expect(entryResult.json.deviceIp).toBe("10.10.0.42");
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("registers a new visitor with only the minimum required public fields", async () => {
    const fixture = await createFixture();
    const visitorCpf = randomCpf();

    try {
      const intakeResult = await requestJson("/api/v1/time-entries/intake", {
        method: "POST",
        body: {
          cpf: visitorCpf,
          plantId: fixture.plantId,
        },
      });

      expect(intakeResult.response.status).toBe(200);
      expect(intakeResult.json.person).toBeNull();
      expect(intakeResult.json.suggestedMode).toBe("ENTRY");

      const visitorPolicy = intakeResult.json.personTypePolicies.find(
        (policy: { personType: string }) => policy.personType === "VISITOR",
      );

      expect(visitorPolicy.requiredFields.map((field: { name: string }) => field.name)).toEqual([
        "fullName",
        "jobTitle",
      ]);

      const entryResult = await requestJson("/api/v1/time-entries/entry", {
        method: "POST",
        body: {
          cpf: `${visitorCpf.slice(0, 3)}.${visitorCpf.slice(3, 6)}.${visitorCpf.slice(6, 9)}-${visitorCpf.slice(9)}`,
          plantId: fixture.plantId,
          fullName: "Visitante Teste",
          personType: "VISITOR",
          jobTitle: "Reuniao com operacao",
          deviceIp: "10.10.0.20",
          wifiSsid: fixture.plantWifiSsid,
          wifiBssid: fixture.plantWifiBssid,
        },
      });

      expect(entryResult.response.status).toBe(200);
      expect(entryResult.json.person.cpf).toBe(visitorCpf);
      expect(entryResult.json.person.personType).toBe("VISITOR");

      const visitor = await prisma.accessProfile.findFirst({
        where: {
          organizationId: fixture.organizationId,
          person: {
            is: { cpf: visitorCpf },
          },
        },
        include: {
          person: true,
        },
      });

      expect(visitor?.person.fullName).toBe("Visitante Teste");
      expect(visitor?.employer).toBe("Visitante");
      expect(visitor?.jobTitle).toBe("Reuniao com operacao");
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("registers a new supervisor with only CPF and nome completo on the public flow", async () => {
    const fixture = await createFixture();
    const supervisorCpf = randomCpf("8");

    try {
      const intakeResult = await requestJson("/api/v1/time-entries/intake", {
        method: "POST",
        body: {
          cpf: supervisorCpf,
          plantId: fixture.plantId,
        },
      });

      expect(intakeResult.response.status).toBe(200);

      const supervisorPolicy = intakeResult.json.personTypePolicies.find(
        (policy: { personType: string }) => policy.personType === "SUPERVISOR",
      );

      expect(
        supervisorPolicy.requiredFields.map((field: { name: string }) => field.name),
      ).toEqual(["fullName"]);

      const entryResult = await requestJson("/api/v1/time-entries/entry", {
        method: "POST",
        body: {
          cpf: supervisorCpf,
          plantId: fixture.plantId,
          fullName: "Supervisor Teste",
          personType: "SUPERVISOR",
          deviceIp: "10.10.0.30",
          wifiSsid: fixture.plantWifiSsid,
          wifiBssid: fixture.plantWifiBssid,
        },
      });

      expect(entryResult.response.status).toBe(200);
      expect(entryResult.json.person.personType).toBe("SUPERVISOR");

      const supervisor = await prisma.accessProfile.findFirst({
        where: {
          organizationId: fixture.organizationId,
          person: {
            is: { cpf: supervisorCpf },
          },
        },
        include: {
          person: true,
        },
      });

      expect(supervisor?.person.fullName).toBe("Supervisor Teste");
      expect(supervisor?.employer).toBe("Supervisao");
      expect(supervisor?.jobTitle).toBe("Supervisor");
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("reuses the same global person across organizations while creating a scoped access profile", async () => {
    const sourceFixture = await createFixture();
    const targetFixture = await createFixture();

    try {
      const entryResult = await requestJson("/api/v1/time-entries/entry", {
        method: "POST",
        body: {
          cpf: sourceFixture.personCpf,
          plantId: targetFixture.plantId,
          personType: "VISITOR",
          jobTitle: "Fornecedor externo",
          deviceIp: "10.10.0.22",
          wifiSsid: targetFixture.plantWifiSsid,
          wifiBssid: targetFixture.plantWifiBssid,
        },
      });

      expect(entryResult.response.status).toBe(200);
      expect(entryResult.json.person.personId).toBe(sourceFixture.globalPersonId);

      const globalPersonCount = await prisma.person.count({
        where: {
          cpf: sourceFixture.personCpf,
        },
      });
      const scopedProfiles = await prisma.accessProfile.findMany({
        where: {
          personId: sourceFixture.globalPersonId,
        },
        orderBy: {
          organizationId: "asc",
        },
      });

      expect(globalPersonCount).toBe(1);
      expect(scopedProfiles).toHaveLength(2);
      expect(scopedProfiles.map((profile) => profile.organizationId)).toEqual([
        sourceFixture.organizationId,
        targetFixture.organizationId,
      ]);
    } finally {
      await cleanupFixture(targetFixture);
      await cleanupFixture(sourceFixture);
    }
  });

  it("blocks public access when wifi validation is required but the plant has no authorized networks", async () => {
    const fixture = await createFixture();

    try {
      await prisma.authorizedNetwork.deleteMany({
        where: {
          plantId: fixture.plantId,
        },
      });

      const networkStatusResult = await requestJson("/api/v1/time-entries/network-status", {
        method: "POST",
        headers: {
          "x-real-ip": fixture.plantPublicIp,
        },
        body: {
          plantId: fixture.plantId,
        },
      });

      expect(networkStatusResult.response.status).toBe(200);
      expect(networkStatusResult.json.network.status).toBe("BLOCKED");
      expect(networkStatusResult.json.ready).toBe(false);
      expect(networkStatusResult.json.network.message).toContain(
        "nao possui configuracoes ativas cadastradas",
      );

      const entryResult = await requestJson("/api/v1/time-entries/entry", {
        method: "POST",
        headers: {
          "x-real-ip": fixture.plantPublicIp,
        },
        body: {
          cpf: fixture.personCpf,
          plantId: fixture.plantId,
        },
      });

      expect(entryResult.response.status).toBe(403);
      expect(entryResult.json.message).toContain("nao possui configuracoes ativas cadastradas");
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("restricts plant supervisors to their own plant across plants, people and manual closing", async () => {
    const fixture = await createFixture();
    const suffix = randomCpf().slice(-6);

    try {
      const otherPlant = await prisma.plant.create({
        data: {
          organizationId: fixture.organizationId,
          code: `plant-scope-${suffix}`,
          name: `Plant Scope ${suffix}`,
          city: "Juazeiro",
          state: "BA",
          openingHour: "06:00",
          closingHour: "18:00",
          qrToken: `qr-scope-${suffix}`,
          authorizedNetworks: {
            create: {
              name: `Network Scope ${suffix}`,
              ssid: `SSID-SCOPE-${suffix}`,
              publicIpv4Cidr: `203.0.113.${50 + (Number.parseInt(suffix.slice(0, 2), 10) % 100)}/32`,
              localIpv4Cidr: "10.20.0.0/24",
            },
          },
        },
      });

      const otherPerson = await prisma.person.create({
        data: {
          cpf: randomCpf("7"),
          fullName: `Scope Person ${suffix}`,
        },
      });

      const otherAccessProfile = await prisma.accessProfile.create({
        data: {
          organizationId: fixture.organizationId,
          personId: otherPerson.id,
          homePlantId: otherPlant.id,
          employer: "Scope Company",
          jobTitle: "Scope Role",
        },
      });

      const otherEntry = await prisma.timeEntry.create({
        data: {
          organizationId: fixture.organizationId,
          accessProfileId: otherAccessProfile.id,
          plantId: otherPlant.id,
          openedAt: new Date(),
          status: "OPEN",
          deviceIp: "10.20.0.22",
        },
      });

      await prisma.user.update({
        where: {
          id: fixture.userId,
        },
        data: {
          role: "PLANT_SUPERVISOR",
          plantId: fixture.plantId,
          modulePermissions: ["dashboard", "plants", "people", "time-entries", "reports"],
        },
      });

      const token = await login(fixture);

      const plantsResult = await requestJson("/api/v1/plants", {
        method: "GET",
        token,
      });
      const peopleResult = await requestJson("/api/v1/people", {
        method: "GET",
        token,
      });
      const otherPlantResult = await requestJson(`/api/v1/plants/${otherPlant.id}`, {
        method: "GET",
        token,
      });
      const liveEntriesResult = await requestJson("/api/v1/time-entries/live", {
        method: "GET",
        token,
      });
      const closeOtherEntryResult = await requestJson(`/api/v1/time-entries/${otherEntry.id}/close`, {
        method: "POST",
        token,
        body: {
          notes: "Supervisor should not close this entry",
        },
      });

      expect(plantsResult.response.status).toBe(200);
      expect(plantsResult.json).toHaveLength(1);
      expect(plantsResult.json[0].id).toBe(fixture.plantId);

      expect(peopleResult.response.status).toBe(200);
      expect(peopleResult.json).toHaveLength(1);
      expect(peopleResult.json[0].homePlantId).toBe(fixture.plantId);

      expect(otherPlantResult.response.status).toBe(403);
      expect(liveEntriesResult.response.status).toBe(200);
      expect(liveEntriesResult.json).toHaveLength(0);

      expect(closeOtherEntryResult.response.status).toBe(404);
      expect(closeOtherEntryResult.json.message).toBe("Registro nao encontrado.");
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it(
    "audits create and update operations for people, plants and access users",
    async () => {
      const fixture = await createFixture();
      const suffix = randomCpf().slice(-6);

      try {
        const token = await login(fixture);

        const createdPersonResult = await requestJson("/api/v1/people", {
          method: "POST",
          token,
          body: {
            fullName: `Audit Person ${suffix}`,
            cpf: randomCpf("6"),
            employer: "Audit Company",
            jobTitle: "Audit Technician",
          },
        });

        expect(createdPersonResult.response.status).toBe(200);

        const updatedPersonResult = await requestJson(
          `/api/v1/people/${createdPersonResult.json.id}`,
          {
            method: "PATCH",
            token,
            body: {
              jobTitle: "Audit Supervisor",
            },
          },
        );

        expect(updatedPersonResult.response.status).toBe(200);

        const createdPlantResult = await requestJson("/api/v1/plants", {
          method: "POST",
          token,
          body: {
            name: `Audit Plant ${suffix}`,
            city: "Petrolina",
            state: "PE",
            openingHour: "06:00",
            closingHour: "18:00",
            authorizedNetworks: [
              {
                name: `Audit Network ${suffix}`,
                publicIpv4Cidr: `203.0.113.${120 + (Number.parseInt(suffix.slice(0, 2), 10) % 80)}/32`,
                localIpv4Cidr: "10.30.0.0/24",
              },
            ],
          },
        });

        expect(createdPlantResult.response.status).toBe(200);

        const updatedPlantResult = await requestJson(
          `/api/v1/plants/${createdPlantResult.json.id}`,
          {
            method: "PATCH",
            token,
            body: {
              name: `Audit Plant Updated ${suffix}`,
            },
          },
        );

        expect(updatedPlantResult.response.status).toBe(200);

        const createdUserResult = await requestJson("/api/v1/access/users", {
          method: "POST",
          token,
          body: {
            name: `Audit User ${suffix}`,
            email: `audit.${suffix}@example.com`,
            password: "Passw0rd!123",
            role: "ADMIN",
          },
        });

        expect(createdUserResult.response.status).toBe(200);

        const updatedUserResult = await requestJson(
          `/api/v1/access/users/${createdUserResult.json.id}`,
          {
            method: "PATCH",
            token,
            body: {
              name: `Audit User Updated ${suffix}`,
            },
          },
        );

        expect(updatedUserResult.response.status).toBe(200);

        const auditLogs = await prisma.auditLog.findMany({
          where: {
            organizationId: fixture.organizationId,
            action: {
              in: [
                "PERSON.CREATED",
                "PERSON.UPDATED",
                "PLANT.CREATED",
                "PLANT.UPDATED",
                "ACCESS_USER.CREATED",
                "ACCESS_USER.UPDATED",
              ],
            },
          },
          select: {
            action: true,
            metadata: true,
          },
        });

        const actions = auditLogs.map((log) => log.action);

        expect(actions).toEqual(
          expect.arrayContaining([
            "PERSON.CREATED",
            "PERSON.UPDATED",
            "PLANT.CREATED",
            "PLANT.UPDATED",
            "ACCESS_USER.CREATED",
            "ACCESS_USER.UPDATED",
          ]),
        );

        expect(
          auditLogs.every((log) => log.metadata && typeof log.metadata === "object"),
        ).toBe(true);
      } finally {
        await cleanupFixture(fixture);
      }
    },
    15000,
  );

  it("returns dashboard overview with overtime alerts and audit feed", async () => {
    const fixture = await createFixture();

    try {
      const token = await login(fixture);
      const openedAt = new Date(Date.now() - 10 * 60 * 60 * 1000);

      await prisma.timeEntry.create({
        data: {
          organizationId: fixture.organizationId,
          accessProfileId: fixture.personId,
          plantId: fixture.plantId,
          openedAt,
          status: "OPEN",
          deviceIp: "10.0.0.10",
        },
      });

      const dashboardResult = await requestJson("/api/v1/dashboard/overview", {
        method: "GET",
        token,
      });
      const auditResult = await requestJson("/api/v1/audit", {
        method: "GET",
        token,
      });

      expect(dashboardResult.response.status).toBe(200);
      expect(dashboardResult.json.activePeople).toBe(1);
      expect(dashboardResult.json.openEntries).toBe(1);
      expect(dashboardResult.json.liveEntries).toHaveLength(1);
      expect(dashboardResult.json.overtimeAlerts).toHaveLength(1);
      expect(dashboardResult.json.overtimeAlerts[0].minutesOpen).toBeGreaterThan(540);

      expect(auditResult.response.status).toBe(200);
      expect(auditResult.json.length).toBeGreaterThan(0);
      expect(
        auditResult.json.some((item: { action: string }) => item.action === "AUTH.LOGIN"),
      ).toBe(true);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("blocks protected routes without a bearer token", async () => {
    const { response, json } = await requestJson("/api/v1/plants", {
      method: "GET",
    });

    expect(response.status).toBe(401);
    expect(json).toEqual({
      message: "Token nao informado.",
    });
  });
});
