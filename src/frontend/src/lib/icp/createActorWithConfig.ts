import type { Backend } from "@/backend";
import { createActor } from "@/backend";
import type { CreateActorOptions } from "@/backend";
import { PythonBackend } from "@/lib/pythonBackend";
import { HttpAgent } from "@icp-sdk/core/agent";
import type { Principal } from "@icp-sdk/core/principal";
import { loadConfig } from "./loadConfig";

function hasGetPrincipal(
  value: unknown,
): value is { getPrincipal: () => Principal } {
  return (
    typeof value === "object" &&
    value !== null &&
    "getPrincipal" in value &&
    typeof (value as { getPrincipal?: unknown }).getPrincipal === "function"
  );
}

async function maybeLoadMockBackend(): Promise<Backend | null> {
  if (import.meta.env.VITE_USE_MOCK !== "true") {
    return null;
  }
  try {
    const mockModules = import.meta.glob("../../mocks/backend.{ts,tsx,js,jsx}");
    const p = Object.keys(mockModules)[0];
    if (!p) return null;
    const mod = (await mockModules[p]()) as { mockBackend?: Backend };
    return mod.mockBackend ?? null;
  } catch {
    return null;
  }
}

export async function createActorWithConfig(
  options: CreateActorOptions = {},
): Promise<Backend> {
  if (import.meta.env.VITE_USE_PYTHON_BACKEND === "true") {
    const rawIdentity = options.agentOptions?.identity;
    const resolvedIdentity =
      rawIdentity &&
      typeof (rawIdentity as PromiseLike<unknown>).then === "function"
        ? await rawIdentity
        : rawIdentity;
    const principal = hasGetPrincipal(resolvedIdentity)
      ? resolvedIdentity.getPrincipal()
      : null;
    return new PythonBackend(principal) as unknown as Backend;
  }

  const mock = await maybeLoadMockBackend();
  if (mock) {
    return mock;
  }
  const config = await loadConfig();
  const agent = new HttpAgent({
    ...options.agentOptions,
    host: config.backend_host,
  });
  if (config.backend_host?.includes("localhost")) {
    await agent.fetchRootKey().catch((err) => {
      console.warn(
        "Unable to fetch root key. Check to ensure that your local replica is running",
      );
      console.error(err);
    });
  }
  return createActor(config.backend_canister_id, {
    ...options,
    agent,
  });
}
