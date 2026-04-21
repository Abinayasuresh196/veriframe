import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAuth } from "../hooks/useAuth";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, register, isLoading, error, loginStatus } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [isRegister, setIsRegister] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Get form values from state
    const formUsername = username.trim();
    const formPassword = password.trim();
    const formEmail = email.trim();

    if (!formUsername || !formPassword) {
      return;
    }

    if (isRegister) {
      await register(formUsername, formPassword, formEmail || undefined);
    } else {
      await login(formUsername, formPassword);
    }
  };

  // Navigate to upload after successful login
  useEffect(() => {
    if (loginStatus === "success" && !isLoading) {
      navigate({ to: "/upload" });
    }
  }, [loginStatus, isLoading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{isRegister ? "Create Account" : "Sign In"}</CardTitle>
          <CardDescription>
            {isRegister
              ? "Create an account to use VeriFrame"
              : "Enter your credentials to continue"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                required
              />
            </div>

            {isRegister && (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email"
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading
                ? "Please wait..."
                : isRegister
                  ? "Create Account"
                  : "Sign In"}
            </Button>
            <div className="text-center pt-2">
              <button
                type="button"
                className="text-sm text-muted-foreground hover:underline"
                onClick={() => {
                  setIsRegister(!isRegister);
                  setEmail("");
                }}
              >
                {isRegister
                  ? "Already have an account? Sign In"
                  : "Don't have an account? Register"}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
