import { defineCommand, option } from "@bunli/core";

import applicationPaths from "constants/application-paths";
import { createNamespaceLogger, profileBegin, profileEnd } from "logging/logger-utilities";
import { getChildrenAsync, removeFileAsync } from "utilities/file-system-utilities";
import { z } from "zod/v4-mini";

const CLEAN_LOGS = "clean-logs";
const logger = createNamespaceLogger(CLEAN_LOGS);

const consoleLog = console.log;

async function deleteFileAsync(filePath: string, rimraf: boolean): Promise<void> {
	const file = Bun.file(filePath);
	const exists = await file.exists();
	if (!exists) {
		logger.warn(`Log file does not exist: ${filePath}`);
		return;
	}

	const promise = rimraf ? removeFileAsync(filePath, {}) : file.delete();
	await promise;
}

export const cleanLogsCommand = defineCommand({
	name: CLEAN_LOGS,
	description: "Cleans up the pendant logs.",
	handler: async ({ colors, flags }) => {
		const children = await getChildrenAsync(applicationPaths.log);

		profileBegin(CLEAN_LOGS);
		await Promise.all(
			children.map(async (child) => {
				logger.info(`Removing log file: ${colors.bold(colors.green(child))}`);
				await deleteFileAsync(child, flags.rimraf);
			}),
		);
		profileEnd(CLEAN_LOGS);

		const newChildren = await getChildrenAsync(applicationPaths.log);
		consoleLog(`There are ${newChildren.length} logs left.`);
	},
	options: {
		rimraf: option(z._default(z.boolean(), false), {
			description: "Use rimraf to clean logs instead of Bun's file system utilities.",
			short: "r",
		}),
	},
});

export default cleanLogsCommand;
