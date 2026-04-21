import { Toaster } from "@/components/ui/sonner";
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
} from "@tanstack/react-router";
import { Suspense } from "react";
import { Layout } from "./components/Layout";
import { AuthProvider } from "./contexts/AuthContext";

const LoginPageComponent = lazyRouteComponent(() => import("./routes/login"));

const LandingPage = lazyRouteComponent(() => import("./routes/index"));
const UploadPageComponent = lazyRouteComponent(
  () => import("./routes/upload"),
  "UploadPageComponent",
);
const ResultsPageComponent = lazyRouteComponent(
  () => import("./routes/results.$id"),
  "ResultsPageComponent",
);
const HistoryPageComponent = lazyRouteComponent(
  () => import("./routes/history"),
  "HistoryPageComponent",
);
const SharedPageComponent = lazyRouteComponent(
  () => import("./routes/shared.$token"),
  "SharedPageComponent",
);

function RouteFallback() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center font-mono text-sm text-muted-foreground">
      Loading…
    </div>
  );
}

const rootRoute = createRootRoute({
  component: () => (
    <>
      <Layout>
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </Layout>
      <Toaster
        position="top-right"
        toastOptions={{
          classNames: {
            toast: "bg-card border-border text-foreground font-mono text-sm",
          },
        }}
      />
    </>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: LandingPage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPageComponent,
});

const uploadRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/upload",
  component: UploadPageComponent,
});

const resultsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/results/$id",
  component: ResultsPageComponent,
});

const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/history",
  component: HistoryPageComponent,
});

const sharedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/shared/$token",
  component: SharedPageComponent,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  uploadRoute,
  resultsRoute,
  historyRoute,
  sharedRoute,
]);

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
