import { api } from "~/trpc/server";

export default async function Home() {
  const { status } = await api.health.getHealth.query();
  const {message} = await api.chaicode.chaiFunc.query({email: "uaioerae@gmail.com"})
  return (
    <main className="min-h-screen min-w-screen flex justify-center items-center">
      <div>
        <h1 className="text-3xl">Sakusaku- your email and calendar AI buddy</h1>
        <h2>Server Status: {status}</h2>
        <h2>{message}</h2>
      </div>
    </main>
  );
}
