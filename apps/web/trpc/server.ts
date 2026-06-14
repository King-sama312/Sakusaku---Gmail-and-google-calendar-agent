import type { ServerRouter } from "@repo/trpc/client";
import { createTRPCProxyClient, httpLink, httpBatchStreamLink } from "@repo/trpc/client";
import { env } from "~/env.js";

export const api = createTRPCProxyClient<ServerRouter>({
  links: [
    httpLink({
      url: `${env.API_URL}/trpc`,
      fetch(url, options) {
        return fetch(url, { ...options, credentials: "include" });
      },
    }),
  ],
});

export const apiStreaming = createTRPCProxyClient<ServerRouter>({
  links: [
    httpBatchStreamLink({
      url: `${env.API_URL}/trpc`,
      fetch(url, options) {
        return fetch(url, { ...options, credentials: "include" });
      },
    }),
  ],
});
