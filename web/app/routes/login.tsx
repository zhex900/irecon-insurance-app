import { redirect } from "react-router";
import { createSessionCookie } from "~/lib/auth/session.server";
import type { Route } from "./+types/login";

export function meta() {
  return [{ title: "Login | CAR Broker Portal" }];
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "");
  if (!email) {
    return { error: "Email is required" };
  }

  return redirect("/dashboard", {
    headers: {
      "Set-Cookie": createSessionCookie(),
    },
  });
}

export default function LoginRoute() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">CAR Insurance</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Broker sign in</h1>
        <p className="mt-2 text-sm text-slate-500">
          Prototype login. Any email will sign you in as the demo broker.
        </p>
        <form method="post" className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Email
            <input
              name="email"
              type="email"
              defaultValue="broker@demo.local"
              className="h-10 rounded-md border border-slate-200 px-3"
            />
          </label>
          <button
            type="submit"
            className="h-10 rounded-md bg-slate-900 text-sm font-medium text-white hover:bg-slate-800"
          >
            Continue
          </button>
        </form>
      </div>
    </main>
  );
}
