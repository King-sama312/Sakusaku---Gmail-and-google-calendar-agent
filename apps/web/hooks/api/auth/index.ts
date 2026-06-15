import { useCallback } from "react";
import { trpc } from "~/trpc/client";

export const useSignup = () => {
  const {
    mutateAsync: createUserWithEmailAndPasswordAsync,
    mutate: createUserWithEmailAndPassword,
    error,
    failureCount,
    isError,
    isIdle,
    isSuccess,
    status,
  } = trpc.auth.createUserWithEmailAndPassword.useMutation();
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
