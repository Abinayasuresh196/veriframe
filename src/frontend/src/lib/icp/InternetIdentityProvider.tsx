import type { Identity } from "@dfinity/agent";
import { AuthClient, type AuthClientCreateOptions } from "@dfinity/auth-client";
import { DelegationIdentity, isDelegationValid } from "@icp-sdk/core/identity";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { loadConfig } from "./loadConfig";

const ONE_HOUR_IN_NANOSECONDS = BigInt(3600000000000);
const DEFAULT_IDENTITY_PROVIDER = process.env.II_URL;

type LoginStatus =
  | "initializing"
  | "idle"
  | "logging-in"
  | "success"
  | "loginError";

export type InternetIdentityContextValue = {
  identity: Identity | undefined;
  login: () => void;
  clear: () => void;
  loginStatus: LoginStatus;
  isInitializing: boolean;
  isLoginIdle: boolean;
  isLoggingIn: boolean;
  isLoginSuccess: boolean;
  isLoginError: boolean;
  loginError: Error | undefined;
};

const InternetIdentityReactContext = createContext<
  InternetIdentityContextValue | undefined
>(undefined);

async function createAuthClient(
  createOptions?: AuthClientCreateOptions,
): Promise<AuthClient> {
  const config = await loadConfig();
  const options: AuthClientCreateOptions = {
    idleOptions: {
      disableDefaultIdleCallback: true,
      disableIdle: true,
      ...createOptions?.idleOptions,
    },
    loginOptions: {
      derivationOrigin: config.ii_derivation_origin,
    },
    ...createOptions,
  };
  return AuthClient.create(options);
}

function assertProviderPresent(
  context: InternetIdentityContextValue | undefined,
): asserts context is InternetIdentityContextValue {
  if (!context) {
    throw new Error(
      "InternetIdentityProvider is not present. Wrap your component tree with it.",
    );
  }
}

export function useInternetIdentity(): InternetIdentityContextValue {
  const context = useContext(InternetIdentityReactContext);
  assertProviderPresent(context);
  return context;
}

type ProviderProps = {
  children: ReactNode;
  createOptions?: AuthClientCreateOptions;
};

export function InternetIdentityProvider({
  children,
  createOptions,
}: ProviderProps) {
  const [authClient, setAuthClient] = useState<AuthClient | undefined>(
    undefined,
  );
  const [identity, setIdentity] = useState<Identity | undefined>(undefined);
  const [loginStatus, setStatus] = useState<LoginStatus>("initializing");
  const [loginError, setError] = useState<Error | undefined>(undefined);

  const setErrorMessage = useCallback((message: string) => {
    setStatus("loginError");
    setError(new Error(message));
  }, []);

  const handleLoginSuccess = useCallback(() => {
    const latestIdentity = authClient?.getIdentity();
    if (!latestIdentity) {
      setErrorMessage("Identity not found after successful login");
      return;
    }
    setIdentity(latestIdentity);
    setStatus("success");
  }, [authClient, setErrorMessage]);

  const handleLoginError = useCallback(
    (maybeError?: string) => {
      setErrorMessage(maybeError ?? "Login failed");
    },
    [setErrorMessage],
  );

  const login = useCallback(() => {
    if (!authClient) {
      setErrorMessage(
        "AuthClient is not initialized yet, make sure to call login on user interaction e.g. click.",
      );
      return;
    }
    const currentIdentity = authClient.getIdentity();
    if (
      !currentIdentity.getPrincipal().isAnonymous() &&
      currentIdentity instanceof DelegationIdentity &&
      isDelegationValid(currentIdentity.getDelegation())
    ) {
      setErrorMessage("User is already authenticated");
      return;
    }
    const options = {
      identityProvider: DEFAULT_IDENTITY_PROVIDER,
      onSuccess: handleLoginSuccess,
      onError: handleLoginError,
      maxTimeToLive: ONE_HOUR_IN_NANOSECONDS * BigInt(24 * 30),
    };
    setStatus("logging-in");
    void authClient.login(options);
  }, [authClient, handleLoginError, handleLoginSuccess, setErrorMessage]);

  const clear = useCallback(() => {
    if (!authClient) {
      setErrorMessage("Auth client not initialized");
      return;
    }
    void authClient
      .logout()
      .then(() => {
        setIdentity(undefined);
        setAuthClient(undefined);
        setStatus("idle");
        setError(undefined);
      })
      .catch((unknownError: unknown) => {
        setStatus("loginError");
        setError(
          unknownError instanceof Error
            ? unknownError
            : new Error("Logout failed"),
        );
      });
  }, [authClient, setErrorMessage]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setStatus("initializing");
        let existingClient = authClient;
        if (!existingClient) {
          existingClient = await createAuthClient(createOptions);
          if (cancelled) return;
          setAuthClient(existingClient);
        }
        const isAuthenticated = await existingClient.isAuthenticated();
        if (cancelled) return;
        if (isAuthenticated) {
          const loadedIdentity = existingClient.getIdentity();
          setIdentity(loadedIdentity);
        }
      } catch (unknownError: unknown) {
        setStatus("loginError");
        setError(
          unknownError instanceof Error
            ? unknownError
            : new Error("Initialization failed"),
        );
      } finally {
        if (!cancelled) setStatus("idle");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [createOptions, authClient]);

  const value = useMemo<InternetIdentityContextValue>(
    () => ({
      identity,
      login,
      clear,
      loginStatus,
      isInitializing: loginStatus === "initializing",
      isLoginIdle: loginStatus === "idle",
      isLoggingIn: loginStatus === "logging-in",
      isLoginSuccess: loginStatus === "success",
      isLoginError: loginStatus === "loginError",
      loginError,
    }),
    [identity, login, clear, loginStatus, loginError],
  );

  return (
    <InternetIdentityReactContext.Provider value={value}>
      {children}
    </InternetIdentityReactContext.Provider>
  );
}
