import type ConfigurationFileType from "meta/configuration-file-type";
import ConfigurationFileTypeMeta, { type Metadata } from "meta/configuration-file-type-meta";
import { join } from "node:path";
import { ContentType, fromPathLike, getExtension, getFilesAsync, readFileAsync } from "utilities/file-system-utilities";
import { z } from "zod/mini";

import { makeJsonSafe } from "./json-utilities";
import { readonlyArray, readonlyObject, strictReadonlyObject } from "./zod-utilities";

const PREFIX_DOT_REGEX = /^\./;

/**
 * A configuration for the pendant tool. This is how you can configure the tool
 * to your liking.
 */
export const isPendantConfiguration = readonlyObject({
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

	/** Files that are known to be problems. These will be ignored. */
	knownProblematicFiles: z.optional(readonlyArray(z.string())).register(z.globalRegistry, {
		deprecated: false,
		description: "Files that are known to be problems. These will be ignored.",
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

async function doesFileExistAsync(bunFile: Bun.BunFile): Promise<boolean> {
	try {
		return await bunFile.exists();
	} catch {
		return false;
	}
}

const FILE_NAMES = [
	".pendant",
	"pendant",
	".pendant-config",
	"pendant-config",
	".pendant-configuration",
	"pendant-configuration",
	".pendant.config",
	"pendant.config",
	".pendant.configuration",
	"pendant.configuration",
];
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
	readonly [ConfigurationFileType, Metadata]
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

export async function getFirstConfigurationAsync(
	searchDirectoryPathLike: Bun.PathLike = process.cwd(),
): Promise<PendantConfiguration> {
	const searchDirectory = fromPathLike(searchDirectoryPathLike);
	for (const fileName of FILE_NAMES) {
		for (const fileExtension of FILE_EXTENSIONS) {
			const fullPath = join(searchDirectory, `${fileName}.${fileExtension}`);
			const file = Bun.file(fullPath);

			if (await doesFileExistAsync(file)) {
				const configurationFileType = resolveConfigurationFileType(fileExtension);
				const { parse } = ConfigurationFileTypeMeta[configurationFileType];

				const content = await file.text();
				const parsed = parse(content);

				const result = await isPendantConfiguration.safeParseAsync(parsed);
				if (!result.success) continue;

				const configuration = result.data;
				if ("$schema" in configuration) delete configuration.$schema;
				return configuration;
			}
		}
	}

	throw new Error(`No pendant configuration file found in "${searchDirectory}".`);
}

const SPECIFIC_FILE_GLOBS = new Array<Bun.Glob>();
const GENERIC_FILE_GLOBS = new Array<Bun.Glob>();

{
	const specificAdded = new Set<string>();
	const genericAdded = new Set<string>();
	function add(array: Array<Bun.Glob>, set: Set<string>, glob: string): void {
		if (set.has(glob)) return;
		set.add(glob);
		array.push(new Bun.Glob(glob));
	}

	for (const fileName of FILE_NAMES) {
		for (const fileExtension of FILE_EXTENSIONS) {
			const specificFileGlob = `${fileName}.${fileExtension}`;
			const genericFileGlob = `*.${fileExtension}`;

			add(SPECIFIC_FILE_GLOBS, specificAdded, specificFileGlob);
			add(GENERIC_FILE_GLOBS, genericAdded, genericFileGlob);
		}
	}
}

function xpcallParse<T>(parse: (source: string) => T, source: string): T {
	try {
		return parse(source);
	} catch (error) {
		const exception = new Error(
			`Failed to parse configuration file: ${error instanceof Error ? error.message : String(error)}:\n${source}`,
		);
		Error.captureStackTrace(exception, xpcallParse);
		throw exception;
	}
}

async function getConfigurationAsync(filePath: string): Promise<PendantConfiguration | undefined> {
	const fileExtension = getExtension(filePath).replace(PREFIX_DOT_REGEX, "");
	const { parse } = ConfigurationFileTypeMeta[resolveConfigurationFileType(fileExtension)];

	const content = await Bun.file(filePath).text().then(makeJsonSafe);
	const parsed = xpcallParse(parse, content);
	// const parsed = parse(content);

	const result = await isPendantConfiguration.safeParseAsync(parsed);
	if (!result.success) return undefined;

	const configuration = result.data;
	if ("$schema" in configuration) delete configuration.$schema;
	return configuration;
}

export async function getFirstConfigurationGlobAsync(
	searchDirectoryPathLike: Bun.PathLike = process.cwd(),
): Promise<PendantConfiguration> {
	const searchDirectory = fromPathLike(searchDirectoryPathLike);
	for (const fileGlob of SPECIFIC_FILE_GLOBS)
		for await (const filePath of fileGlob.scan(searchDirectory)) {
			const configuration = await getConfigurationAsync(filePath);
			if (configuration) return configuration;
		}

	for (const fileGlob of GENERIC_FILE_GLOBS)
		for await (const filePath of fileGlob.scan(searchDirectory)) {
			const configuration = await getConfigurationAsync(filePath);
			if (configuration) return configuration;
		}

	throw new Error(`No pendant configuration file found in "${searchDirectory}".`);
}

const DOT_START_TRIM_REGEX = /^[.]/;
function trimStrip(value: string): string {
	return value.trim().replace(DOT_START_TRIM_REGEX, "");
}

function brace(values: Iterable<string>): string {
	return `{${[...new Set(values)].map(trimStrip).join(",")}}`;
}

const NAME_ALTERNATIONS = brace(FILE_NAMES);
const EXTENSION_ALTERNATIONS = brace(FILE_EXTENSIONS);

const SPECIFIC_FILE_GLOB = new Bun.Glob(`${NAME_ALTERNATIONS}.${EXTENSION_ALTERNATIONS}`);
const GENERIC_FILE_GLOB = new Bun.Glob(`*.${EXTENSION_ALTERNATIONS}`);

// eslint-disable-next-line id-length -- i do not care
export async function getFirstConfigurationGlob2Async(
	searchDirectoryPathLike: Bun.PathLike = process.cwd(),
): Promise<PendantConfiguration> {
	const searchDirectory = fromPathLike(searchDirectoryPathLike);

	for await (const filePath of SPECIFIC_FILE_GLOB.scan(searchDirectory)) {
		const configuration = await getConfigurationAsync(filePath);
		if (configuration) return configuration;
	}

	for await (const filePath of GENERIC_FILE_GLOB.scan(searchDirectory)) {
		const configuration = await getConfigurationAsync(filePath);
		if (configuration) return configuration;
	}

	throw new Error(`No pendant configuration file found in "${searchDirectory}".`);
}

// eslint-disable-next-line id-length -- i do not care
export async function getFirstConfigurationGlob3Async(
	searchDirectoryPathLike: Bun.PathLike = process.cwd(),
): Promise<PendantConfiguration> {
	const searchDirectory = fromPathLike(searchDirectoryPathLike);
	const children = await getFilesAsync(searchDirectory);
	if (children.length === 0) throw new Error(`No files found in "${searchDirectory}".`);

	for (const childPath of children) {
		if (!SPECIFIC_FILE_GLOB.match(childPath)) continue;
		const configuration = await getConfigurationAsync(childPath);
		if (configuration) return configuration;
	}

	for (const childPath of children) {
		if (!GENERIC_FILE_GLOB.match(childPath)) continue;
		const configuration = await getConfigurationAsync(childPath);
		if (configuration) return configuration;
	}

	throw new Error(`No pendant configuration file found in "${searchDirectory}".`);
}
