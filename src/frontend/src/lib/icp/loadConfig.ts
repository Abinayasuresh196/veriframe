export type AppConfig = {
  backend_host?: string;
  backend_canister_id: string;
  ii_derivation_origin?: string;
};

let configCache: AppConfig | null = null;

export function resetConfigCache(): void {
  configCache = null;
}

export async function loadConfig(): Promise<AppConfig> {
  if (configCache) {
    return configCache;
  }
  const usePythonBackend = import.meta.env.VITE_USE_PYTHON_BACKEND === "true";

  if (usePythonBackend) {
    const fallback: AppConfig = {
      backend_host: undefined,
      backend_canister_id: "python-backend",
      ii_derivation_origin: undefined,
    };
    configCache = fallback;
    return fallback;
  }

  const backendCanisterId = process.env.CANISTER_ID_BACKEND;
  const envBaseUrl = process.env.BASE_URL || "/";
  const baseUrl = envBaseUrl.endsWith("/") ? envBaseUrl : `${envBaseUrl}/`;
  try {
    const response = await fetch(`${baseUrl}env.json`);
    const config = (await response.json()) as Record<string, string>;
    if (!backendCanisterId && config.backend_canister_id === "undefined") {
      console.error("CANISTER_ID_BACKEND is not set");
      throw new Error("CANISTER_ID_BACKEND is not set");
    }
    const full: AppConfig = {
      backend_host:
        config.backend_host === "undefined" ? undefined : config.backend_host,
      backend_canister_id:
        config.backend_canister_id === "undefined"
          ? (backendCanisterId as string)
          : config.backend_canister_id,
      ii_derivation_origin:
        config.ii_derivation_origin === "undefined"
          ? undefined
          : config.ii_derivation_origin,
    };
    configCache = full;
    return full;
  } catch {
    if (!backendCanisterId) {
      console.error("CANISTER_ID_BACKEND is not set");
      throw new Error("CANISTER_ID_BACKEND is not set");
    }
    const fallback: AppConfig = {
      backend_host: undefined,
      backend_canister_id: backendCanisterId as string,
      ii_derivation_origin: undefined,
    };
    configCache = fallback;
    return fallback;
  }
}
