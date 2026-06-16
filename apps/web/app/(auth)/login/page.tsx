import { GoogleSignIn } from "~/components/google-sign-in";

export default function LoginPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <GoogleSignIn />
    </div>
  );
}
