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
