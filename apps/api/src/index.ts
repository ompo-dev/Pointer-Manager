import { app } from "./app";
import { env } from "./core/config/env";
import { Server as SocketIOServer } from "socket.io";
import {
  expandLocalOrigins,
  getPrimaryLocalIpv4Address,
} from "./core/network/local-network";
import { appServices } from "./shared/kernel/app-services";

const allowedCorsOrigins =
  env.NODE_ENV === "development" ? true : expandLocalOrigins(env.CORS_ORIGIN);

const io = new SocketIOServer({
  cors: {
    origin: allowedCorsOrigins,
    credentials: true,
    methods: ["GET", "POST"],
  },
  transports: ["websocket"],
});

appServices.operationsHub.attach(io);
io.on("connection", (socket) => {
  appServices.operationsHub.handleConnection(socket);
});
io.listen(env.SOCKET_IO_PORT);

app.listen({ port: env.PORT, hostname: env.HOST }, () => {
  const localAddress = getPrimaryLocalIpv4Address();
  const localApiUrl = `http://localhost:${env.PORT}`;
  const localSocketUrl = `http://localhost:${env.SOCKET_IO_PORT}`;
  const networkApiUrl = localAddress ? `http://${localAddress}:${env.PORT}` : null;
  const networkSocketUrl = localAddress
    ? `http://${localAddress}:${env.SOCKET_IO_PORT}`
    : null;

  console.log(`api listening on ${localApiUrl}`);
  if (networkApiUrl) {
    console.log(`api network on ${networkApiUrl}`);
  }

  console.log(`socket.io listening on ${localSocketUrl}`);
  if (networkSocketUrl) {
    console.log(`socket.io network on ${networkSocketUrl}`);
  }
});
