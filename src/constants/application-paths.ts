import envPaths, { type Paths } from "env-paths";

import { name } from "./package-constants";

/**
 * Provides platform-specific paths for storing application data, configuration,
 * cache, log, and temporary files. Utilizes the `env-paths` package to generate
 * these paths based on the application's name.
 *
 * @remarks
 * The returned `Paths` object contains properties such as `data`, `config`,
 * `cache`, `log`, and `temp`, which are resolved according to the current
 * operating system's conventions.
 * @example
 *
 * ```typescript
 * import applicationPaths from "./constants/application-paths";
 * console.log(applicationPaths.data); // Prints the path for application data storage
 * ```
 *
 * @see {@link https://www.npmjs.com/package/env-paths | env-paths documentation}
 */
export const applicationPaths: Paths = envPaths(name);
export default applicationPaths;
