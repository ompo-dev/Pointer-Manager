import { app } from "./app";
import { env } from "./core/config/env";

app.listen(env.PORT, () => {
  console.log(`api listening on http://localhost:${env.PORT}`);
});
