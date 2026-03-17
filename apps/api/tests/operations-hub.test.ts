import { describe, expect, it } from "bun:test";
import type { Server as SocketIOServer, Socket } from "socket.io";
import { OperationsHub } from "../src/core/realtime/operations-hub";

describe("operations hub", () => {
  it("publishes events to the global room and the filtered plant room", () => {
    const hub = new OperationsHub();
    const calls: Array<{ room: string; eventName: string; payload: unknown }> = [];
    const io = {
      to(room: string) {
        return {
          emit(eventName: string, payload: unknown) {
            calls.push({ room, eventName, payload });
          },
        };
      },
    } as unknown as SocketIOServer;

    hub.attach(io);

    hub.publish({
      type: "entry.created",
      plantId: "plant-a",
      payload: {
        entryId: "entry-1",
      },
      createdAt: new Date().toISOString(),
    });

    expect(calls).toHaveLength(2);
    expect(calls[0]?.room).toBe("scope:all");
    expect(calls[0]?.eventName).toBe("operations:event");
    expect(calls[1]?.room).toBe("scope:plant:plant-a");
    expect(calls[1]?.eventName).toBe("operations:event");
  });

  it("joins the correct room and emits a readable snapshot on connect", () => {
    const hub = new OperationsHub();
    const joinedRooms: string[] = [];
    const emittedEvents: Array<{ eventName: string; payload: unknown }> = [];

    const socket = {
      handshake: {
        query: {
          plantId: "plant-a",
        },
      },
      join(room: string) {
        joinedRooms.push(room);
      },
      emit(eventName: string, payload: unknown) {
        emittedEvents.push({ eventName, payload });
      },
    } as unknown as Socket;

    hub.handleConnection(socket);

    expect(joinedRooms).toEqual(["scope:plant:plant-a"]);
    expect(emittedEvents).toHaveLength(1);
    expect(emittedEvents[0]?.eventName).toBe("operations:event");
    expect(emittedEvents[0]?.payload).toMatchObject({
      type: "presence.snapshot",
      plantId: "plant-a",
    });
  });
});
