import { auth } from "@point-manager/auth/server";
import { prisma } from "@api/core/database/prisma-client";
import { defaultPermissionsByRole } from "@api/domains/auth/domain/user-role";
import { appServices } from "@api/shared/kernel/app-services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const encoder = new TextEncoder();

function encodeSseChunk(lines: string[]) {
  return encoder.encode(`${lines.join("\n")}\n\n`);
}

function createEventChunk(event: {
  id: string;
  type: string;
  plantId?: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}) {
  return encodeSseChunk([
    `id: ${event.id}`,
    "event: operations",
    `data: ${JSON.stringify({
      type: event.type,
      plantId: event.plantId ?? undefined,
      payload: event.payload,
      createdAt: event.createdAt,
    })}`,
  ]);
}

function createCommentChunk(comment: string) {
  return encodeSseChunk([`: ${comment}`]);
}

function normalizeModulePermissions(role: keyof typeof defaultPermissionsByRole, modulePermissions: unknown) {
  if (!Array.isArray(modulePermissions)) {
    return defaultPermissionsByRole[role];
  }

  const normalized = modulePermissions.filter((value): value is (typeof defaultPermissionsByRole)[typeof role][number] =>
    typeof value === "string" && defaultPermissionsByRole[role].includes(value as never),
  );

  return normalized.length > 0 ? normalized : defaultPermissionsByRole[role];
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({
    headers: new Headers(request.headers),
  });

  if (!session?.user?.id) {
    return new Response(JSON.stringify({ message: "Nao autenticado." }), {
      status: 401,
      headers: {
        "content-type": "application/json; charset=utf-8",
      },
    });
  }

  const persistedUser = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!persistedUser || persistedUser.status !== "ACTIVE") {
    return new Response(JSON.stringify({ message: "Usuario nao autorizado." }), {
      status: 401,
      headers: {
        "content-type": "application/json; charset=utf-8",
      },
    });
  }

  const requestUrl = new URL(request.url);
  const requestedPlantId = requestUrl.searchParams.get("plantId");
  const plantId =
    persistedUser.role === "PLANT_SUPERVISOR" && persistedUser.plantId
      ? persistedUser.plantId
      : requestedPlantId;

  appServices.auth.requirePlantScope(
    {
      id: persistedUser.id,
      organizationId: persistedUser.organizationId,
      plantId: persistedUser.plantId,
      name: persistedUser.name,
      email: persistedUser.email,
      role: persistedUser.role,
      status: persistedUser.status,
      modulePermissions: normalizeModulePermissions(
        persistedUser.role,
        persistedUser.modulePermissions,
      ),
    },
    plantId,
  );

  const streamStartedAt = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let lastSeenAt = streamStartedAt;
      let lastSeenIds = new Set<string>();
      let closed = false;
      let pollTimer: ReturnType<typeof setInterval> | null = null;
      let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

      const closeStream = () => {
        if (closed) {
          return;
        }

        closed = true;
        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
        controller.close();
      };

      const pushSnapshot = () => {
        controller.enqueue(
          createEventChunk({
            id: `presence-snapshot-${Date.now()}`,
            type: "presence.snapshot",
            plantId,
            payload: {
              message: plantId
                ? "Canal operacional conectado para a usina filtrada."
                : "Canal operacional conectado para todo o painel.",
              transport: "sse",
            },
            createdAt: new Date().toISOString(),
          }),
        );
      };

      const pollEvents = async () => {
        try {
          const events = await prisma.realtimeEvent.findMany({
            where: {
              organizationId: persistedUser.organizationId,
              channel: "operations",
              plantId: plantId ?? undefined,
              createdAt: {
                gte: new Date(lastSeenAt),
              },
            },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            take: 100,
          });

          for (const event of events) {
            const eventTime = event.createdAt.getTime();
            const alreadySeen =
              eventTime < lastSeenAt ||
              (eventTime === lastSeenAt && lastSeenIds.has(event.id));

            if (alreadySeen) {
              continue;
            }

            controller.enqueue(
              createEventChunk({
                id: event.id,
                type: event.type,
                plantId: event.plantId,
                payload:
                  event.payload && typeof event.payload === "object" && !Array.isArray(event.payload)
                    ? (event.payload as Record<string, unknown>)
                    : {},
                createdAt: event.createdAt.toISOString(),
              }),
            );

            if (eventTime > lastSeenAt) {
              lastSeenAt = eventTime;
              lastSeenIds = new Set([event.id]);
            } else {
              lastSeenIds.add(event.id);
            }
          }
        } catch (error) {
          console.error(error);
          closeStream();
        }
      };

      pollTimer = setInterval(() => {
        void pollEvents();
      }, 2000);

      heartbeatTimer = setInterval(() => {
        if (closed) {
          return;
        }

        controller.enqueue(createCommentChunk("keep-alive"));
      }, 15000);

      request.signal.addEventListener("abort", closeStream);

      pushSnapshot();
      void pollEvents();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
