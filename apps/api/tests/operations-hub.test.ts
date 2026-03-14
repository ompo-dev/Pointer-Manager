import { describe, expect, it } from "bun:test";
import { OperationsHub } from "../src/core/realtime/operations-hub";

describe("operations hub", () => {
  it("publishes to unfiltered sockets and matching plant subscribers", () => {
    const hub = new OperationsHub();
    const messages: string[] = [];
    const filteredMessages: string[] = [];
    const ignoredMessages: string[] = [];

    const allSocket = {
      send(payload: string) {
        messages.push(payload);
      },
    };
    const plantSocket = {
      data: {
        query: {
          plantId: "plant-a",
        },
      },
      send(payload: string) {
        filteredMessages.push(payload);
      },
    };
    const otherPlantSocket = {
      data: {
        query: {
          plantId: "plant-b",
        },
      },
      send(payload: string) {
        ignoredMessages.push(payload);
      },
    };

    hub.connect(allSocket);
    hub.connect(plantSocket);
    hub.connect(otherPlantSocket);

    hub.publish({
      type: "entry.created",
      plantId: "plant-a",
      payload: {
        entryId: "entry-1",
      },
      createdAt: new Date().toISOString(),
    });

    expect(messages).toHaveLength(1);
    expect(filteredMessages).toHaveLength(1);
    expect(ignoredMessages).toHaveLength(0);

    hub.disconnect(plantSocket);
    hub.publish({
      type: "entry.closed",
      plantId: "plant-a",
      payload: {
        entryId: "entry-1",
      },
      createdAt: new Date().toISOString(),
    });

    expect(messages).toHaveLength(2);
    expect(filteredMessages).toHaveLength(1);
  });
});
