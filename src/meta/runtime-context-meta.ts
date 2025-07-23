import type { ChalkInstance } from "chalk";
import chalk from "chalk";

import type { PendantConfiguration } from "../utilities/configuration-utilities";
import RuntimeContext from "./runtime-context";

export interface Metadata {
	readonly chalkInstance?: ChalkInstance;
	readonly emoji: string;
	readonly keyName: keyof PendantConfiguration["files"];
	readonly name: string;
}

export const RuntimeContextMeta: Readonly<Record<RuntimeContext, Metadata>> = {
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
