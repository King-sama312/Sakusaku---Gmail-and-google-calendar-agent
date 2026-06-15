import { useCallback } from "react";
import { trpc } from "~/trpc/client";

export const useSignup = () => {
  const utils = trpc.useUtils();
  const {
    mutateAsync: createUserWithEmailAndPasswordAsync,
    mutate: createUserWithEmailAndPassword,
    error,
    failureCount,
    isError,
    isIdle,
    isSuccess,
    status,
  } = trpc.auth.createUserWithEmailAndPassword.useMutation({
    onSuccess: async () => {
      utils.auth.getLoggedInUserInfo.invalidate();
    },
  });
  return {
    createUserWithEmailAndPasswordAsync,
    createUserWithEmailAndPassword,
    error,
    failureCount,
    isError,
    isIdle,
    isSuccess,
    status,
  };
};

export const useGoogleAuth = () => {
  const { data, isLoading } = trpc.auth.getSupportedAuthenticationProviders.useQuery();

  const googleProvider = data?.find((p) => p.provider === "GOOGLE_OAUTH");

  const signInWithGoogle = useCallback(() => {
    if (googleProvider?.authUrl) {
      window.location.href = googleProvider.authUrl;
    }
  }, [googleProvider]);

  return {
    authUrl: googleProvider?.authUrl,
    isLoading,
    signInWithGoogle,
  };
};

export const useLogin = () => {
  const utils = trpc.useUtils();
  const {
    mutateAsync: signInUserWithEmailAndPasswordAsync,
    mutate: signInUserWithEmailAndPassword,
    error,
    failureCount,
    isError,
    isIdle,
    isSuccess,
    status,
  } = trpc.auth.signInUserWithEmailAndPassword.useMutation({
    onSuccess: async () => {
      utils.auth.getLoggedInUserInfo.invalidate();
    },
  });
  return {
    signInUserWithEmailAndPasswordAsync,
    signInUserWithEmailAndPassword,
    error,
    failureCount,
    isError,
    isIdle,
    isSuccess,
    status,
  };
};

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

export const useSendVerificationEmail = () => {
  const {
    mutateAsync: sendVerificationEmailAsync,
    isPending,
    isSuccess,
    error,
  } = trpc.auth.sendVerificationEmail.useMutation();
  return { sendVerificationEmailAsync, isPending, isSuccess, error };
};

export const useVerifyEmail = () => {
  const {
    mutateAsync: verifyEmailAsync,
    isPending,
    isSuccess,
    error,
  } = trpc.auth.verifyEmail.useMutation();
  return { verifyEmailAsync, isPending, isSuccess, error };
};

export const useSendPasswordResetEmail = () => {
  const {
    mutateAsync: sendPasswordResetEmailAsync,
    isPending,
    isSuccess,
    error,
  } = trpc.auth.sendPasswordResetEmail.useMutation();
  return { sendPasswordResetEmailAsync, isPending, isSuccess, error };
};

export const useResetPassword = () => {
  const {
    mutateAsync: resetPasswordAsync,
    isPending,
    isSuccess,
    error,
  } = trpc.auth.resetPassword.useMutation();
  return { resetPasswordAsync, isPending, isSuccess, error };
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
