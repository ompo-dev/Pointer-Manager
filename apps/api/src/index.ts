import { app } from "./app";
import { env } from "./core/config/env";
import { Server as SocketIOServer } from "socket.io";
import { appServices } from "./shared/kernel/app-services";

const io = new SocketIOServer({
  cors: {
    origin: env.CORS_ORIGIN,
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

app.listen(env.PORT, () => {
  console.log(`api listening on http://localhost:${env.PORT}`);
  console.log(`socket.io listening on http://localhost:${env.SOCKET_IO_PORT}`);
});
