export function getSessionSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET?.trim() ||
    (process.env.NODE_ENV !== "production" ? "zacx-local-session-secret" : "")
  );
}
