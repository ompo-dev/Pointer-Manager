import type { Server as SocketIOServer, Socket } from "socket.io";

export interface OperationsEvent {
  type: "presence.snapshot" | "entry.created" | "entry.closed" | "entry.adjusted";
  plantId?: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

const GLOBAL_SCOPE = "scope:all";

function buildPlantScope(plantId: string) {
  return `scope:plant:${plantId}`;
}

export class OperationsHub {
  private io: SocketIOServer | null = null;

  attach(io: SocketIOServer) {
    this.io = io;
  }

  handleConnection(socket: Socket) {
    const plantId = this.readPlantScope(socket);

    if (plantId) {
      socket.join(buildPlantScope(plantId));
    } else {
      socket.join(GLOBAL_SCOPE);
    }

    socket.emit("operations:event", {
      type: "presence.snapshot",
      plantId,
      payload: {
        message: plantId
          ? "Canal em tempo real conectado para a usina filtrada."
          : "Canal em tempo real conectado para todo o painel.",
      },
      createdAt: new Date().toISOString(),
    } satisfies OperationsEvent);
  }

  publish(event: OperationsEvent) {
    if (!this.io) {
      return;
    }

    if (!event.plantId) {
      this.io.to(GLOBAL_SCOPE).emit("operations:event", event);
      return;
    }

    this.io.to(GLOBAL_SCOPE).emit("operations:event", event);
    this.io.to(buildPlantScope(event.plantId)).emit("operations:event", event);
  }

  private readPlantScope(socket: Socket) {
    const queryValue = socket.handshake.query.plantId;

    if (typeof queryValue !== "string") {
      return undefined;
    }

    const normalized = queryValue.trim();
    return normalized ? normalized : undefined;
  }
}
