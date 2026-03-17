import { createAuthClient } from "better-auth/react";
import { jwtClient } from "better-auth/client/plugins";

const appUrl =
  typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

export const authClient = createAuthClient({
  baseURL: appUrl,
  plugins: [jwtClient()],
});
