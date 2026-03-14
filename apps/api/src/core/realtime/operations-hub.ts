export interface OperationsEvent {
  type: "presence.snapshot" | "entry.created" | "entry.closed" | "entry.adjusted";
  plantId?: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

interface SocketLike {
  data?: {
    query?: Record<string, string | undefined>;
  };
  send: (payload: string) => void;
}

export class OperationsHub {
  private readonly sockets = new Set<SocketLike>();

  connect(socket: SocketLike) {
    this.sockets.add(socket);
  }

  disconnect(socket: SocketLike) {
    this.sockets.delete(socket);
  }

  publish(event: OperationsEvent) {
    const serialized = JSON.stringify(event);

    for (const socket of this.sockets) {
      const queryPlantId = socket.data?.query?.plantId;

      if (queryPlantId && event.plantId && queryPlantId !== event.plantId) {
        continue;
      }

      socket.send(serialized);
    }
  }
}
