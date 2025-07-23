/**
 * Checks if the application is running in developer mode. Basically just means
 * non-production.
 */
export const IS_DEVELOPER_MODE = (Bun.env.NODE_ENV ?? "development") !== "production";
