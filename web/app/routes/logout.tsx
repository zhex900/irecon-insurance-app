import { redirect } from "react-router";
import { destroySessionCookie } from "~/lib/auth/session.server";
import type { Route } from "./+types/logout";

export async function action() {
  return redirect("/login", {
    headers: {
      "Set-Cookie": destroySessionCookie(),
    },
  });
}

export async function loader() {
  return redirect("/login");
}
