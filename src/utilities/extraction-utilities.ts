import { createZipReader } from "@holmlibs/unzip";

import generateSchemaAsync from "functions/generate-schema-async";
import logger from "logging/logger";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { rimraf } from "rimraf";

import { fromPathLike } from "./file-system-utilities";

const CWD = process.cwd();

async function updateSchemasAsync(foldersToRemove: ReadonlyArray<string>): Promise<void> {
	try {
		await Promise.all(
			foldersToRemove.map(async (folderPath) =>
				generateSchemaAsync(
					"draft-7",
					join(folderPath, ".schemas", "pendant-configuration.schema.json"),
					false,
				),
			),
		);
	} catch (error: unknown) {
		logger.error(`Failed to update schemas: ${error instanceof Error ? error.message : String(error)}`);
	}
}

/**
 * Extracts configuration files from a ZIP archive to a target directory.
 *
 * This function reads a ZIP file (by default, `files/configuration-files.zip`
 * in the current working directory), and extracts all its contents to the
 * specified output directory (by default, `configuration-files`). It throws an
 * error if the source ZIP file does not exist.
 *
 * @example
 *
 * ```typescript
 * await extractConfigurationFilesAsync();
 * // Extracts from ./files/configuration-files.zip to ./configuration-files
 * ```
 *
 * @param extractFromPathLike - The path to the ZIP archive to extract from.
 *   Defaults to `__CWD__/files/configuration-files.zip` in the current working
 *   directory.
 * @param extractToPathLike - The directory to extract files into. Defaults to
 *   `__CWD__/configuration-files` in the current working directory.
 * @returns A promise that resolves with a cleanup function when extraction is
 *   complete.
 * @throws {Error} If the source ZIP file does not exist or cannot be read.
 * @see {@link createZipReader} for ZIP extraction implementation.
 */
export async function extractConfigurationFilesAsync(
	extractFromPathLike: Bun.PathLike = join(CWD, "files", "configuration-files.zip"),
	extractToPathLike: Bun.PathLike = join(CWD, "configuration-files"),
): Promise<() => Promise<void>> {
	const extractFrom = fromPathLike(extractFromPathLike);
	const extractTo = fromPathLike(extractToPathLike);

	const exists = await Bun.file(extractFrom).exists();
	if (!exists) throw new Error(`The file ${extractFrom} does not exist.`);

	const zipReader = createZipReader(extractFrom);
	await zipReader.extractAll(extractTo);

	const foldersToRemove = new Array<string>();
	for (const [name] of zipReader.getEntries()) {
		if (!name.endsWith("/")) continue;
		const totalSlashes = name.split("/").length;
		if (totalSlashes <= 2) foldersToRemove.push(join(extractTo, name));
	}

	await updateSchemasAsync(foldersToRemove);

	return async function cleanupAsync(): Promise<void> {
		for (const folderPath of foldersToRemove) await rimraf(folderPath, {});
		const children = await readdir(extractTo, {});
		if (children.length === 0) await rimraf(extractTo, {});
	};
}
