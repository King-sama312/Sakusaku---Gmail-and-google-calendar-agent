import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "~/trpc/client";

export const useGetUserInfo = () => {
  const {
    data: user,
    isError,
    isFetched,
    isFetching,
    isLoading,
    status,
  } = trpc.auth.getLoggedInUserInfo.useQuery();

  return { user, isError, isFetched, isFetching, isLoading, status };
};

export const useSetAuthCookie = () => {
  const utils = trpc.useUtils();
  const {
    mutateAsync: setAuthCookieAsync,
    mutate: setAuthCookie,
    isSuccess,
    error,
  } = trpc.auth.setAuthCookie.useMutation({
    onSuccess: async () => {
      utils.auth.getLoggedInUserInfo.invalidate();
    },
  });
  return { setAuthCookieAsync, setAuthCookie, isSuccess, error };
};

export const useSignOut = () => {
  const utils = trpc.useUtils();

  const {
    mutateAsync: signOutAsync,
    mutate: signOut,
    error,
    failureCount,
    isError,
    isIdle,
    isSuccess,
    status,
  } = trpc.auth.signOut.useMutation({
    onSuccess: async () => {
      utils.auth.getLoggedInUserInfo.invalidate();
    },
  });

  return {
    signOutAsync,
    signOut,
    error,
    failureCount,
    isError,
    isIdle,
    isSuccess,
    status,
  };
};

/**
 * Redirect unauthenticated users to /login.
 * Call this at the top of a client page that requires auth.
 */
export function useRequireAuth() {
  const { user, isLoading, isError, isFetched } = useGetUserInfo();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isFetched && (!user || isError)) {
      router.replace("/login");
    }
  }, [isLoading, isFetched, user, isError, router]);

  return { user, isLoading };
}
