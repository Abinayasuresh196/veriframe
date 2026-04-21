import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { useLocation } from "@tanstack/react-router";
import {
  Clock,
  Cpu,
  LogIn,
  LogOut,
  Menu,
  Shield,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";

interface LayoutProps {
  children: React.ReactNode;
}

const navLinks = [
  { href: "/", label: "Home", icon: Shield },
  { href: "/upload", label: "Upload", icon: Upload, protected: true },
  { href: "/history", label: "History", icon: Clock, protected: true },
];

export function Layout({ children }: LayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { isAuthenticated, logout, principal, username, isLoading } = useAuth();
  const location = useLocation();
  const { pathname } = location;

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const principalShort = principal
    ? `${principal.toString().slice(0, 5)}…${principal.toString().slice(-3)}`
    : null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-smooth",
          "border-b",
          scrolled
            ? "bg-card/95 backdrop-blur-md border-border shadow-elevated"
            : "bg-card/80 backdrop-blur-sm border-transparent",
        )}
        data-ocid="site-header"
      >
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2.5 group"
            aria-label="VeriFrame home"
          >
            <div className="relative w-8 h-8 flex items-center justify-center">
              <div className="absolute inset-0 rounded bg-primary/20 group-hover:bg-primary/30 transition-smooth" />
              <Cpu size={18} className="text-primary relative z-10" />
            </div>
            <span className="font-mono font-bold text-lg tracking-tight">
              <span className="text-foreground">VERI</span>
              <span className="text-primary">FRAME</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav
            className="hidden md:flex items-center gap-1"
            aria-label="Main navigation"
          >
            {navLinks.map(
              ({ href, label, icon: Icon, protected: isProtected }) => {
                if (isProtected && !isAuthenticated) return null;
                const active =
                  pathname === href ||
                  (href !== "/" && pathname.startsWith(href));
                return (
                  <Link
                    key={href}
                    to={href}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-smooth",
                      active
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                    )}
                    data-ocid={`nav-${label.toLowerCase()}`}
                  >
                    <Icon size={14} />
                    {label}
                  </Link>
                );
              },
            )}
          </nav>

          {/* Auth + Hamburger */}
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <div className="hidden md:flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded border border-border">
                  {username || principalShort}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={logout}
                  className="gap-1.5 text-xs"
                  data-ocid="logout-btn"
                >
                  <LogOut size={12} />
                  Sign Out
                </Button>
              </div>
            ) : (
              <Link to="/login">
                <Button
                  size="sm"
                  disabled={isLoading}
                  className="hidden md:flex gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                  data-ocid="login-btn"
                >
                  <LogIn size={12} />
                  {isLoading ? "Connecting…" : "Sign In"}
                </Button>
              </Link>
            )}

            <button
              type="button"
              className="md:hidden p-2 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-smooth"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              data-ocid="hamburger-btn"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <div
          className={cn(
            "md:hidden overflow-hidden transition-all duration-300 ease-in-out",
            menuOpen ? "max-h-80 border-t border-border" : "max-h-0",
          )}
        >
          <nav
            className="px-4 py-3 bg-card flex flex-col gap-1"
            aria-label="Mobile navigation"
          >
            {navLinks.map(
              ({ href, label, icon: Icon, protected: isProtected }) => {
                if (isProtected && !isAuthenticated) return null;
                const active =
                  pathname === href ||
                  (href !== "/" && pathname.startsWith(href));
                return (
                  <Link
                    key={href}
                    to={href}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2.5 rounded text-sm font-medium transition-smooth",
                      active
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                    )}
                  >
                    <Icon size={16} />
                    {label}
                  </Link>
                );
              },
            )}
            <div className="mt-2 pt-2 border-t border-border">
              {isAuthenticated ? (
                <div className="flex flex-col gap-2">
                  <span className="font-mono text-xs text-muted-foreground px-3 py-1">
                    {username || principalShort}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={logout}
                    className="gap-1.5 justify-start"
                    data-ocid="mobile-logout-btn"
                  >
                    <LogOut size={14} />
                    Sign Out
                  </Button>
                </div>
              ) : (
                <Link to="/login" className="w-full">
                  <Button
                    size="sm"
                    disabled={isLoading}
                    className="w-full gap-1.5"
                    data-ocid="mobile-login-btn"
                  >
                    <LogIn size={14} />
                    {isLoading ? "Connecting…" : "Sign In"}
                  </Button>
                </Link>
              )}
            </div>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pt-16">{children}</main>

      {/* Footer */}
      <footer className="bg-card border-t border-border mt-auto">
        <div className="container mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Cpu size={14} className="text-primary" />
            <span className="font-mono text-xs font-semibold text-foreground">
              VERIFRAME
            </span>
            <span className="text-muted-foreground text-xs">
              — AI Video Forensics
            </span>
          </div>
          <p className="text-muted-foreground text-xs text-center">
            © {new Date().getFullYear()} VeriFrame. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
