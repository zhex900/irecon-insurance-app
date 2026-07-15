const SESSION_COOKIE = "car_broker_session";

export function isAuthenticated(request: Request) {
  const cookie = request.headers.get("Cookie") ?? "";
  return cookie.includes(`${SESSION_COOKIE}=1`);
}

export function createSessionCookie() {
  return `${SESSION_COOKIE}=1; Path=/; HttpOnly; SameSite=Lax`;
}

export function destroySessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function requireAuth(request: Request) {
  if (!isAuthenticated(request)) {
    throw new Response(null, {
      status: 302,
      headers: { Location: "/login" },
    });
  }
}
