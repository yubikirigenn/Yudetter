import { createAuthClient } from "better-auth/react";
import { multiSessionClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: window.location.origin,
  plugins: [
    multiSessionClient(),
  ],
});

export const { signIn, signUp, signOut, useSession } = authClient;
