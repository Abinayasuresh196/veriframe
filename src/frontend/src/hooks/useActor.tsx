import type { Backend } from "@/backend";
import type { CreateActorOptions } from "@/backend";
import { useInternetIdentity } from "@/lib/icp/InternetIdentityProvider";
import { createActorWithConfig } from "@/lib/icp/createActorWithConfig";
import { useAuthContext } from "../contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

const ACTOR_QUERY_KEY = "actor";

function hasAccessControl(
  actor: unknown,
): actor is { _initializeAccessControl: () => Promise<void> } {
  return (
    typeof actor === "object" &&
    actor !== null &&
    "_initializeAccessControl" in actor &&
    typeof (actor as { _initializeAccessControl: unknown })
      ._initializeAccessControl === "function"
  );
}

export function useActor() {
  const { identity } = useInternetIdentity();
  const auth = useAuthContext();
  const queryClient = useQueryClient();

  // Combine identities: II identity takes priority, then fallback to manual auth principal
  const resolvedPrincipal = identity?.getPrincipal() ?? auth.principal;
  const principalKey = resolvedPrincipal?.toString() || "anonymous";

  const actorQuery = useQuery({
    queryKey: [ACTOR_QUERY_KEY, principalKey],
    queryFn: async (): Promise<Backend> => {
      // If we have an II identity, use it (standard IC flow)
      if (identity) {
        const actorOptions: CreateActorOptions = {
          agentOptions: {
            identity,
          },
        };
        const actor = await createActorWithConfig(actorOptions);
        if (hasAccessControl(actor)) {
          await actor._initializeAccessControl();
        }
        return actor;
      }

      // If we don''t have II, check if we have a manual principal (Python flow)
      const actorOptions: CreateActorOptions = {
        agentOptions: {
          // Dummy payload to pass the principal to createActorWithConfig
          identity: (resolvedPrincipal ? { getPrincipal: () => resolvedPrincipal } : undefined) as any,
        },
      };
      
      const actor = await createActorWithConfig(actorOptions);
      if (hasAccessControl(actor)) {
        await actor._initializeAccessControl();
      }
      return actor;
    },
    staleTime: Number.POSITIVE_INFINITY,
    enabled: true,
  });

  useEffect(() => {
    if (actorQuery.data) {
      queryClient.invalidateQueries({
        predicate: (query) => !query.queryKey.includes(ACTOR_QUERY_KEY),
      });
      queryClient.refetchQueries({
        predicate: (query) => !query.queryKey.includes(ACTOR_QUERY_KEY),
      });
    }
  }, [actorQuery.data, queryClient]);

  return {
    actor: actorQuery.data ?? null,
    isFetching: actorQuery.isFetching,
  };
}
