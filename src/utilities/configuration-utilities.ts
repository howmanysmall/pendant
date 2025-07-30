import logger from "logging/logger";
import type ConfigurationFileType from "meta/configuration-file-type";
import ConfigurationFileTypeMeta, { type ConfigurationFileTypeMetadata } from "meta/configuration-file-type-meta";
import GitHubDownloadType from "meta/github-download-type";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { ContentType, fromPathLike, readFileAsync } from "utilities/file-system-utilities";
import { z } from "zod/mini";

import { readonlyArray, readonlyObject, strictReadonlyObject } from "./zod-utilities";

const PREFIX_DOT_REGEX = /^\./;

/**
 * A configuration for the pendant tool. This is how you can configure the tool
 * to your liking.
 */
export const isPendantConfiguration = readonlyObject({
	/**
	 * The type of fetch to use for downloading files from GitHub. Defaults to
	 * `fetch`.
	 */
	fetchType: z
		.optional(
			z._default(z.enum([GitHubDownloadType.Fetch, GitHubDownloadType.OctokitCore]), GitHubDownloadType.Fetch),
		)
		.register(z.globalRegistry, {
			deprecated: false,
			description: "The type of fetch to use for downloading files from GitHub. Defaults to `fetch`.",
		}),

	/**
	 * How you configure the contexts for files. These are Roblox service class
	 * names.
	 */
	files: strictReadonlyObject({
		/** The files to include for the client context. */
		client: readonlyArray(z.string()).register(z.globalRegistry, {
			deprecated: false,
			description: "The files to include for the client context.",
		}),
		/** The files to include for the server context. */
		server: readonlyArray(z.string()).register(z.globalRegistry, {
			deprecated: false,
			description: "The files to include for the client context.",
		}),
		/** The files to include for the shared context. */
		shared: readonlyArray(z.string()).register(z.globalRegistry, {
			deprecated: false,
			description: "The files to include for the shared context.",
		}),
		/** The files to include for the testing context. Not required. */
		testing: z.optional(readonlyArray(z.string())).register(z.globalRegistry, {
			deprecated: false,
			description: "The files to include for the testing context. Not required.",
		}),
	}),

	/**
	 * Globs of files to be ignored. These files will not be analyzed or
	 * included in the output.
	 */
	ignoreGlobs: z.optional(readonlyArray(z.string())).register(z.globalRegistry, {
		deprecated: false,
		description: "Globs of files to be ignored. These files will not be analyzed or included in the output.",
	}),

	/**
	 * The name of the file to output the analysis results to. Defaults to
	 * `problematic`.
	 */
	outputFileName: z.optional(z._default(z.string(), "problematic")).register(z.globalRegistry, {
		deprecated: false,
		description: "The name of the file to output the analysis results to. Defaults to `problematic`.",
	}),

	/**
	 * The project file to use for the pendant tool. Defaults to
	 * `default.project.json`.
	 */
	projectFile: z
		.optional(z._default(z.string().check(z.regex(/^.*\.project\.json$/)), "default.project.json"))
		.register(z.globalRegistry, {
			deprecated: false,
			description: "The project file to use for the pendant tool. Defaults to `default.project.json`.",
		}),
}).register(z.globalRegistry, {
	deprecated: false,
	description: "A configuration for the pendant tool. This is how you can configure the tool to your liking.",
});

/**
 * A configuration for the pendant tool. This is how you can configure the tool
 * to your liking.
 */
export type PendantConfiguration = Omit<z.infer<typeof isPendantConfiguration>, "$schema">;

/**
 * Reads the pendant configuration from a file.
 *
 * @param pathLike - The path to the configuration file. Defaults to
 *   `.pendant.json`.
 * @returns The parsed pendant configuration.
 */
export async function getPendantConfigurationAsync(
	pathLike: Bun.PathLike = ".pendant.json",
): Promise<PendantConfiguration> {
	const path = fromPathLike(pathLike);

	const exists = await Bun.file(path).exists();
	if (!exists) throw new Error(`Project file does not exist: ${path}`);

	const configuration = await readFileAsync(path, ContentType.Json, isPendantConfiguration);
	if ("$schema" in configuration) delete configuration.$schema;
	return configuration;
}

const FILE_EXTENSIONS = new Array<string>();
{
	let length = 0;
	function append(fileExtensions: ReadonlySet<string>): void {
		for (const fileExtension of fileExtensions) {
			const extension = fileExtension.replace(PREFIX_DOT_REGEX, "").trim();
			if (extension.length === 0) continue;
			FILE_EXTENSIONS[length++] = extension;
		}
	}

	for (const metadata of Object.values(ConfigurationFileTypeMeta)) append(metadata.fileExtensions);
}

const ALL_ENTRIES = Object.entries(ConfigurationFileTypeMeta) as unknown as ReadonlyArray<
	readonly [ConfigurationFileType, ConfigurationFileTypeMetadata]
>;
const extensionToFileTypeCache = new Map<string, ConfigurationFileType>();

function resolveConfigurationFileType(extension: string): ConfigurationFileType {
	const cached = extensionToFileTypeCache.get(extension);
	if (cached !== undefined) return cached;

	for (const [configurationFileType, { fileExtensions }] of ALL_ENTRIES) {
		if (!fileExtensions.has(extension)) continue;
		extensionToFileTypeCache.set(extension, configurationFileType);
		return configurationFileType;
	}

	throw new Error(`Unsupported file extension: ${extension}`);
}

for (const fileExtension of FILE_EXTENSIONS) resolveConfigurationFileType(fileExtension);

const PRIORITY_NAMES = [".pendant", "pendant"];
const PRIORITY_EXTENSIONS = ["json", "yaml", "yml", "toml"];

const ALL_EXTENSIONS = new Set(
	Object.values(ConfigurationFileTypeMeta)
		.flatMap((metadata): ReadonlyArray<string> => [...metadata.fileExtensions])
		.map((extension) => extension.replace(PREFIX_DOT_REGEX, ""))
		.filter(Boolean),
);
const ALL_NAMES = new Set([
	".pendant-config",
	".pendant-configuration",
	".pendant.config",
	".pendant.configuration",
	"pendant-config",
	"pendant-configuration",
	"pendant.config",
	"pendant.configuration",
	...PRIORITY_NAMES,
]);

const parserByExtension = new Map<string, (text: string) => unknown>();
for (const [, { fileExtensions, parse }] of ALL_ENTRIES)
	for (const fileExtension of fileExtensions)
		parserByExtension.set(fileExtension.replace(PREFIX_DOT_REGEX, ""), parse);

function splitNameExtension(fileName: string): readonly [fileName: string, extension: string] {
	const index = fileName.lastIndexOf(".");
	return index === -1 ? [fileName, ""] : [fileName.slice(0, index), fileName.slice(index + 1)];
}

function rank(fileName: string): number {
	const [name, extension] = splitNameExtension(fileName);
	let score = 0;

	const nameIndex = PRIORITY_NAMES.indexOf(name);
	if (nameIndex !== -1) score += (10 - nameIndex) * 1000;

	const extensionIndex = PRIORITY_EXTENSIONS.indexOf(extension);
	if (extensionIndex !== -1) score += 10 - extensionIndex;

	return -score;
}

function isCandidateName(fileName: string): boolean {
	const [name, extension] = splitNameExtension(fileName);
	return ALL_NAMES.has(name) && ALL_EXTENSIONS.has(extension);
}
function sortCandidates(a: string, b: string): number {
	return rank(a) - rank(b);
}

/**
 * Searches for and reads the first valid pendant configuration file from a
 * directory by checking paths in parallel.
 *
 * This function searches for configuration files in a specific priority order,
 * checking for various names (e.g., `.pendant`, `pendant-config`) and
 * extensions (e.g., `json`, `yaml`, `toml`). It returns the first file that it
 * finds, successfully parses, and validates against the configuration schema.
 * It optimizes the search by attempting to read all possible file paths
 * concurrently.
 *
 * @param searchDirectoryPathLike - The directory to search in. Defaults to the
 *   current working directory.
 * @returns A promise that resolves to the parsed pendant configuration.
 * @throws {Error} If no valid configuration file is found in the specified
 *   directory.
 */
export async function getFirstConfigurationAsync(
	searchDirectoryPathLike: Bun.PathLike = process.cwd(),
): Promise<PendantConfiguration> {
	const searchDirectory = fromPathLike(searchDirectoryPathLike);

	let paths: ReadonlyArray<string>;
	try {
		paths = await readdir(searchDirectory);
	} catch (error) {
		throw new Error(`Directory not accessible: ${searchDirectory}. Error: ${(error as Error).message}`);
	}

	const candidates = paths.filter(isCandidateName).sort(sortCandidates);
	const promises = candidates.map(async (fileName) => {
		const extension = splitNameExtension(fileName)[1];
		const parse = parserByExtension.get(extension);
		if (!parse) return;

		const fullPath = join(searchDirectory, fileName);
		try {
			const text = await Bun.file(fullPath).text();
			const parsed = parse(text);
			const result = isPendantConfiguration.safeParse(parsed);
			if (result.success) {
				const configuration = result.data;
				if ("$schema" in configuration) delete configuration.$schema;
				return configuration;
			}
		} catch (error) {
			logger.warn(
				`Failed to read or parse file: ${fullPath}. Error: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	});

	const results = await Promise.all(promises);
	for (const result of results) if (result !== undefined) return result;

	throw new Error("No pendant configuration file found");
}
