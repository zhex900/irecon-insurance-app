import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes";

export default [
  route(
    ".well-known/appspecific/com.chrome.devtools.json",
    "routes/well-known.chrome-devtools.tsx",
  ),
  index("routes/_index.tsx"),
  route("login", "routes/_auth/login.tsx"),
  route("logout", "routes/_auth/logout.tsx"),
  route("forgot-password", "routes/_auth/forgot-password.tsx"),
  route("reset-password", "routes/_auth/reset-password.tsx"),
  route("auth/confirm", "routes/_auth/confirm.tsx"),
  route(
    "api/policies/:policyId/draft",
    "routes/api/policies.$policyId.draft.tsx",
  ),
  route(
    "api/policies/:policyId/documents",
    "routes/api/policies.$policyId.documents.tsx",
  ),
  route(
    "api/policies/:policyId/email-documents",
    "routes/api/policies.$policyId.email-documents.tsx",
  ),
  route(
    "api/clients/:clientId/draft",
    "routes/api/clients.$clientId.draft.tsx",
  ),
  route("api/avatars/:userId", "routes/api/avatars.$userId.tsx"),
  route("api/library-documents", "routes/api/library-documents.tsx"),
  route(
    "api/library-documents/file/:filename",
    "routes/api/library-documents.file.$filename.tsx",
  ),
  route("api/library-documents/:id", "routes/api/library-documents.$id.tsx"),
  route("api/audit", "routes/api/audit.tsx"),
  route("api/search", "routes/api/search.tsx"),
  layout("routes/_app/layout.tsx", [
    route("dashboard", "routes/_app/dashboard.tsx"),
    route("clients", "routes/_app/clients/_index.tsx"),
    route("clients/new", "routes/_app/clients/new.tsx"),
    route("clients/:clientId/edit", "routes/_app/clients/$clientId.edit.tsx"),
    route("clients/:clientId", "routes/_app/clients/$clientId.tsx"),
    route("policies", "routes/_app/policies/_index.tsx"),
    route("policies/new", "routes/_app/policies/new.tsx"),
    route(
      "policies/:policyId/adjust",
      "routes/_app/policies/$policyId.adjust.tsx",
    ),
    route("policies/:policyId", "routes/_app/policies/$policyId.tsx"),
    route("reports", "routes/_app/reports/_index.tsx"),
    route("reports/clients", "routes/_app/reports/clients.tsx"),
    route("reports/car-policies", "routes/_app/reports/car-policies.tsx"),
    route("reports/car-renewals", "routes/_app/reports/car-renewals.tsx"),
    // More-specific /settings/* paths before the index so they always win.
    route("settings/ar-brokers", "routes/_app/settings/ar-brokers.tsx"),
    route("settings/users", "routes/_app/settings/users.tsx"),
    route(
      "settings/email-templates",
      "routes/_app/settings/email-templates.tsx",
    ),
    route("settings/features", "routes/_app/settings/features.tsx"),
    route(
      "settings/library-documents",
      "routes/_app/settings/library-documents.tsx",
    ),
    route("settings/prices", "routes/_app/settings/prices.tsx", [
      index("routes/_app/settings/prices/_index.tsx"),
      route(":catalogue", "routes/_app/settings/prices/$catalogue.tsx", [
        route("new", "routes/_app/settings/prices/$catalogue.new.tsx"),
        route(":id", "routes/_app/settings/prices/$catalogue.$id.tsx"),
      ]),
    ]),
    route("settings/audit-log", "routes/_app/settings/audit-log.tsx"),
    route("settings", "routes/_app/settings/_index.tsx"),
  ]),

  route("*", "routes/$.tsx"),
] satisfies RouteConfig;
