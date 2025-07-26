import type { ChalkInstance } from "chalk";
import chalk from "chalk";
import type { PendantConfiguration } from "utilities/configuration-utilities";

import RuntimeContext from "./runtime-context";

/**
 * Metadata describing a runtime context (Client, Server, Shared, etc).
 *
 * @property name - Human-readable name for the context.
 * @property emoji - Emoji representing the context.
 * @property keyName - Key used in configuration files.
 * @property chalkInstance - (Optional) Chalk instance for colored output.
 */
export interface RuntimeContextMetadata {
	/** Optional Chalk instance for colored output. */
	readonly chalkInstance?: ChalkInstance;
	/** Emoji representing the context. */
	readonly emoji: string;
	/** Key used in configuration files. */
	readonly keyName: keyof PendantConfiguration["files"];
	/** Human-readable name for the context. */
	readonly name: string;
}

/**
 * Metadata for all supported runtime contexts.
 *
 * @remarks
 * Maps each {@linkcode RuntimeContext} to its metadata for display,
 * configuration, and formatting.
 */
export const RuntimeContextMeta: Readonly<Record<RuntimeContext, RuntimeContextMetadata>> = {
	[RuntimeContext.Client]: {
		name: "Client",
		chalkInstance: chalk.bold.green,
		emoji: "🟢",
		keyName: "client",
	},
	[RuntimeContext.Server]: {
		name: "Server",
		chalkInstance: chalk.bold.blue,
		emoji: "🔵",
		keyName: "server",
	},
	[RuntimeContext.Shared]: {
		name: "Shared",
		chalkInstance: chalk.bold.yellow,
		emoji: "🟡",
		keyName: "shared",
	},
	[RuntimeContext.Testing]: {
		name: "Testing",
		chalkInstance: chalk.bold.hex("#B23DFB"),
		emoji: "🟣",
		keyName: "testing",
	},
	[RuntimeContext.Unknown]: {
		name: "Unknown",
		chalkInstance: chalk.dim,
		emoji: "⚪️",
		keyName: "shared", // Default to shared for unknown contexts
	},
};

export default RuntimeContextMeta;
