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
        message: "Credenciais inválidas.",
      });
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("lists plants and employees for the authenticated organization", async () => {
    const fixture = await createFixture();

    try {
      const token = await login(fixture);

      const plantsResult = await requestJson("/api/v1/plants", {
        method: "GET",
        token,
      });
      const employeesResult = await requestJson("/api/v1/employees", {
        method: "GET",
        token,
      });

      expect(plantsResult.response.status).toBe(200);
      expect(plantsResult.json).toHaveLength(1);
      expect(plantsResult.json[0].authorizedNetworks).toHaveLength(1);

      expect(employeesResult.response.status).toBe(200);
      expect(employeesResult.json).toHaveLength(1);
      expect(employeesResult.json[0].cpf).toBe(fixture.employeeCpf);
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
            cpf: fixture.employeeCpf,
            plantToken: fixture.plantToken,
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
            cpf: fixture.employeeCpf,
            plantToken: fixture.plantToken,
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
        expect(liveEntriesResult.json[0].employee.cpf).toBe(fixture.employeeCpf);

        const exitResult = await requestJson("/api/v1/time-entries/exit", {
          method: "POST",
          body: {
            cpf: fixture.employeeCpf,
            plantToken: fixture.plantToken,
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
          cpf: `${fixture.employeeCpf.slice(0, 3)}.${fixture.employeeCpf.slice(3, 6)}.${fixture.employeeCpf.slice(6, 9)}-${fixture.employeeCpf.slice(9)}`,
          plantToken: fixture.plantToken,
        },
      });

      expect(initialIntake.response.status).toBe(200);
      expect(initialIntake.json.person.fullName).toBeDefined();
      expect(initialIntake.json.suggestedMode).toBe("ENTRY");
      expect(initialIntake.json.personTypePolicies.length).toBeGreaterThan(0);

      const entryResult = await requestJson("/api/v1/time-entries/entry", {
        method: "POST",
        body: {
          cpf: fixture.employeeCpf,
          plantToken: fixture.plantToken,
          deviceIp: "10.10.0.12",
          wifiSsid: fixture.plantWifiSsid,
          wifiBssid: fixture.plantWifiBssid,
        },
      });

      expect(entryResult.response.status).toBe(200);

      const exitIntake = await requestJson("/api/v1/time-entries/intake", {
        method: "POST",
        body: {
          cpf: fixture.employeeCpf,
          plantToken: fixture.plantToken,
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
    const ethernetLikeIp = fixture.plantWifiCidr.replace(".0/24", ".42");

    try {
      const entryResult = await requestJson("/api/v1/time-entries/entry", {
        method: "POST",
        body: {
          cpf: fixture.employeeCpf,
          plantToken: fixture.plantToken,
          deviceIp: ethernetLikeIp,
          networkType: "cellular",
          networkEffectiveType: "4g",
        },
      });

      expect(entryResult.response.status).toBe(200);
      expect(entryResult.json.validationNotes).toContain("Conexao autorizada na rede");
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
          "x-real-ip": "10.10.0.42",
        },
        body: {
          plantToken: fixture.plantToken,
        },
      });

      expect(networkStatusResult.response.status).toBe(200);
      expect(networkStatusResult.json.network.status).toBe("AUTHORIZED");
      expect(networkStatusResult.json.network.matchedNetworkName).toBeDefined();
      expect(networkStatusResult.json.network.currentNetworkName).toBeDefined();
      expect(networkStatusResult.json.network.observedIp).toBe("10.10.0.42");
      expect(networkStatusResult.json.location.status).toBe("OPEN");

      const entryResult = await requestJson("/api/v1/time-entries/entry", {
        method: "POST",
        headers: {
          "x-real-ip": "10.10.0.42",
        },
        body: {
          cpf: fixture.employeeCpf,
          plantToken: fixture.plantToken,
        },
      });

      expect(entryResult.response.status).toBe(200);
      expect(entryResult.json.deviceIp).toBe("10.10.0.42");
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
          "x-real-ip": "10.10.0.42",
        },
        body: {
          plantToken: fixture.plantToken,
        },
      });

      expect(pendingLocationResult.response.status).toBe(200);
      expect(pendingLocationResult.json.location.status).toBe("PENDING");
      expect(pendingLocationResult.json.ready).toBe(false);

      const authorizedLocationResult = await requestJson("/api/v1/time-entries/network-status", {
        method: "POST",
        headers: {
          "x-real-ip": "10.10.0.42",
        },
        body: {
          plantToken: fixture.plantToken,
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
          plantToken: fixture.plantToken,
          browserIpCandidates: ["10.10.0.42"],
          networkType: "wifi",
        },
      });

      expect(networkStatusResult.response.status).toBe(200);
      expect(networkStatusResult.json.network.status).toBe("AUTHORIZED");
      expect(networkStatusResult.json.network.observedIp).toBe("10.10.0.42");

      const entryResult = await requestJson("/api/v1/time-entries/entry", {
        method: "POST",
        body: {
          cpf: fixture.employeeCpf,
          plantToken: fixture.plantToken,
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
          plantToken: fixture.plantToken,
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
          plantToken: fixture.plantToken,
          fullName: "Visitante Teste",
          personType: "VISITOR",
          jobTitle: "Reuniao com operacao",
          deviceIp: "10.10.0.20",
          wifiSsid: fixture.plantWifiSsid,
          wifiBssid: fixture.plantWifiBssid,
        },
      });

      expect(entryResult.response.status).toBe(200);
      expect(entryResult.json.employee.cpf).toBe(visitorCpf);
      expect(entryResult.json.employee.personType).toBe("VISITOR");

      const visitor = await prisma.employee.findUnique({
        where: { cpf: visitorCpf },
      });

      expect(visitor?.fullName).toBe("Visitante Teste");
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
          plantToken: fixture.plantToken,
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
          plantToken: fixture.plantToken,
          fullName: "Supervisor Teste",
          personType: "SUPERVISOR",
          deviceIp: "10.10.0.30",
          wifiSsid: fixture.plantWifiSsid,
          wifiBssid: fixture.plantWifiBssid,
        },
      });

      expect(entryResult.response.status).toBe(200);
      expect(entryResult.json.employee.personType).toBe("SUPERVISOR");

      const supervisor = await prisma.employee.findUnique({
        where: { cpf: supervisorCpf },
      });

      expect(supervisor?.fullName).toBe("Supervisor Teste");
      expect(supervisor?.employer).toBe("Supervisao");
      expect(supervisor?.jobTitle).toBe("Supervisor");
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("returns dashboard overview with overtime alerts and audit feed", async () => {
    const fixture = await createFixture();

    try {
      const token = await login(fixture);
      const openedAt = new Date(Date.now() - 10 * 60 * 60 * 1000);

      await prisma.timeEntry.create({
        data: {
          organizationId: fixture.organizationId,
          employeeId: fixture.employeeId,
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
      expect(dashboardResult.json.activeEmployees).toBe(1);
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
      message: "Token não informado.",
    });
  });
});
