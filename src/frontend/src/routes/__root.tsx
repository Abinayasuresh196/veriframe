import { Toaster } from "@/components/ui/sonner";
import { Outlet, createRootRoute } from "@tanstack/react-router";
import { Layout } from "../components/Layout";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <>
      <Layout>
        <Outlet />
      </Layout>
      <Toaster
        position="top-right"
        toastOptions={{
          classNames: {
            toast: "bg-card border-border text-foreground font-mono text-sm",
            title: "font-semibold",
            description: "text-muted-foreground",
          },
        }}
      />
    </>
  );
}
