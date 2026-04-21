import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { PythonBackend } from "@/lib/pythonBackend";
import type { Principal } from "@icp-sdk/core/principal";

const PYTHON_MODE = import.meta.env.VITE_USE_PYTHON_BACKEND === "true";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  loginStatus: "idle" | "logging-in" | "success" | "loginError" | "registering";
  principal: Principal | null;
  username: string | null;
  error: string | null;
  login: (user?: string, pass?: string) => Promise<void>;
  register: (user: string, pass: string, email?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [loginStatus, setLoginStatus] = useState<
    "idle" | "logging-in" | "success" | "loginError" | "registering"
  >("idle");
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (PYTHON_MODE) {
      const savedUser = localStorage.getItem("veriframe_user");
      const savedName = localStorage.getItem("veriframe_username");
      if (savedUser && savedName) {
        setLoginStatus("success");
        setPrincipal(savedUser as unknown as Principal);
        setUsername(savedName);
      }
    }
  }, []);

  const login = async (user?: string, pass?: string) => {
    if (!PYTHON_MODE) return;

    setIsLoading(true);
    setLoginStatus("logging-in");
    setError(null);

    const loginUser = user || "demo";
    const loginPass = pass || "demo";

    try {
      const backend = new PythonBackend(null);
      const userId = await backend.login(loginUser, loginPass);
      setLoginStatus("success");
      localStorage.setItem("veriframe_user", userId);
      localStorage.setItem("veriframe_username", loginUser);
      setPrincipal(userId as unknown as Principal);
      setUsername(loginUser);
    } catch (_e) {
      setLoginStatus("loginError");
      setError("Invalid username or password");
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (user: string, pass: string, email?: string) => {
    if (!PYTHON_MODE) return;

    setIsLoading(true);
    setLoginStatus("registering");
    setError(null);

    try {
      const backend = new PythonBackend(null);
      const userId = await backend.registerWithEmail(user, pass, email);
      setLoginStatus("success");
      localStorage.setItem("veriframe_user", userId);
      localStorage.setItem("veriframe_username", user);
      setPrincipal(userId as unknown as Principal);
      setUsername(user);
    } catch (_e) {
      setLoginStatus("loginError");
      setError("Username already taken");
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("veriframe_user");
    localStorage.removeItem("veriframe_username");
    setLoginStatus("idle");
    setPrincipal(null);
    setUsername(null);
  };

  const isAuthenticated = loginStatus === "success" && principal !== null;

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    loginStatus,
    principal,
    username,
    error,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
