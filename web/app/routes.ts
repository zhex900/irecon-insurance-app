import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  route(
    ".well-known/appspecific/com.chrome.devtools.json",
    "routes/well-known.chrome-devtools.tsx",
  ),
  index("routes/_index.tsx"),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),
  layout("routes/app-layout.tsx", [
    route("dashboard", "routes/dashboard.tsx"),
    route("clients", "routes/clients._index.tsx"),
    route("clients/new", "routes/clients.new.tsx"),
    route("clients/:clientId", "routes/clients.$clientId.tsx"),
    route("quotes/new", "routes/quotes.new.tsx"),
    route("quotes/:policyId/adjust", "routes/quotes.$policyId.adjust.tsx"),
    route("quotes/:policyId", "routes/quotes.$policyId.tsx"),
  ]),
] satisfies RouteConfig;
