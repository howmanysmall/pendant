import { createNamespaceLogger } from "logging/logger-utilities";
import type RobloxService from "meta/roblox-service";
import RobloxServiceMeta from "meta/roblox-service-meta";
import RuntimeContext from "meta/runtime-context";
import RuntimeContextMeta from "meta/runtime-context-meta";
import { basename, matchesGlob } from "node:path";
import { ContentType, fromPathLike, readFileAsync } from "utilities/file-system-utilities";

import type { PendantConfiguration } from "./configuration-utilities";

const logger = createNamespaceLogger("rojo-project-utilities");

type BaseRojoTreeEntry =
	| {
			readonly $className: string;
			readonly $ignoreUnknownInstances?: boolean;
			readonly $path: string;
			readonly $properties?: Record<string, unknown>;
	  }
	| {
			readonly $className: string;
			readonly $ignoreUnknownInstances?: boolean;
			readonly $path?: string;
			readonly $properties?: Record<string, unknown>;
	  }
	| {
			readonly $className?: string;
			readonly $ignoreUnknownInstances?: boolean;
			readonly $path: string;
			readonly $properties?: Record<string, unknown>;
	  };
/**
 * Represents a node in a Rojo project tree, corresponding to a Roblox instance.
 *
 * @remarks
 * Each entry may represent a service, folder, or other instance, and may
 * contain nested children.
 */
export type RojoTreeEntry = BaseRojoTreeEntry & { readonly [key: string]: RojoTreeEntry };

/**
 * Represents a parsed Rojo project file, including its tree and metadata.
 *
 * @property name - The name of the Rojo project, typically used to identify the
 *   project in logs or UIs.
 * @property tree - The root of the project tree.
 * @property gameId - (Optional) Roblox game ID.
 * @property placeId - (Optional) Roblox place ID.
 * @property serveAddress - (Optional) Address for serving.
 * @property servePort - (Optional) Port for serving.
 * @property servePlaceIds - (Optional) Place IDs for serving.
 * @property globIgnorePaths - (Optional) Paths to ignore.
 */
export interface RojoProject {
	/** The Roblox game ID, if present. */
	readonly gameId?: number;
	/** Paths to ignore, if present. */
	readonly globIgnorePaths?: ReadonlyArray<string>;
	/**
	 * The name of the Rojo project, typically used to identify the project in
	 * logs or UIs.
	 */
	readonly name: string;
	/** The Roblox place ID, if present. */
	readonly placeId?: number;
	/** The address to serve from, if present. */
	readonly serveAddress?: string;
	/** The place IDs to serve, if present. */
	readonly servePlaceIds?: ReadonlyArray<number>;
	/** The port to serve from, if present. */
	readonly servePort?: number;
	/** The root of the project tree. */
	readonly tree: RojoTreeEntry;
}

const PROJECT_JSON_GLOB = new Bun.Glob("*.project.json");

/**
 * Loads and parses a Rojo project file from disk.
 *
 * @example
 *
 * ```typescript
 * const project = await getProjectFromFileAsync("game.project.json");
 * ```
 *
 * @param pathLike - The path to the Rojo project file (defaults to
 *   "default.project.json").
 * @returns The parsed {@linkcode RojoProject} object.
 * @throws {TypeError} If the file does not match the expected pattern.
 * @throws {Error} If the file does not exist or cannot be read.
 */
export async function getProjectFromFileAsync(pathLike: Bun.PathLike = "default.project.json"): Promise<RojoProject> {
	const path = fromPathLike(pathLike);
	const fileName = basename(path);
	if (!PROJECT_JSON_GLOB.match(fileName)) throw new TypeError(`Expected a *.project.json file, got: ${path}`);

	const exists = await Bun.file(path).exists();
	if (!exists) throw new Error(`Project file does not exist: ${path}`);

	return readFileAsync(path, ContentType.Json);
}

function isRojoTreeEntry(entry: unknown, key: string): entry is RojoTreeEntry {
	return (
		key !== "$className" &&
		key !== "$ignoreUnknownInstances" &&
		key !== "$path" &&
		key !== "$properties" &&
		typeof entry === "object" &&
		entry !== null &&
		!Array.isArray(entry)
	);
}
function isRobloxService(key: unknown): key is RobloxService {
	return typeof key === "string" && key in RobloxServiceMeta;
}
function isRuntimeContext(key: unknown): key is RuntimeContext {
	return typeof key === "string" && key in RuntimeContextMeta;
}

const contextEntries = Object.entries(RuntimeContextMeta) as unknown as ReadonlyArray<
	readonly [RuntimeContext, { keyName: string }]
>;

function getRuntimeContextFromKey(key: string): RuntimeContext | undefined {
	// this has a weird bug where this doesn't want to support a reverse lookup table - who knows atp.
	for (const [context, metadata] of contextEntries) if (metadata.keyName === key) return context;
	return undefined;
}

/**
 * Maps each runtime context to an array of Rojo tree entries.
 *
 * @see RuntimeContext
 * @see RojoTreeEntry
 */
export type RuntimeEntryMap = Record<RuntimeContext, Array<RojoTreeEntry>>;

/**
 * Maps each runtime context to an array of file paths.
 *
 * @see RuntimeContext
 */
export type RuntimePathMap = Record<RuntimeContext, Array<string>>;

/**
 * Classifies Rojo tree entries into runtime contexts based on configuration and
 * fallback rules.
 *
 * @param project - The parsed Rojo project.
 * @param configuration - The Pendant configuration object.
 * @returns A map from runtime context to arrays of tree entries.
 */
export function collectIntoRuntimeMap({ tree }: RojoProject, configuration: PendantConfiguration): RuntimeEntryMap {
	const runtimeMap: RuntimeEntryMap = {
		[RuntimeContext.Client]: [],
		[RuntimeContext.Server]: [],
		[RuntimeContext.Shared]: [],
		[RuntimeContext.Testing]: [],
		[RuntimeContext.Unknown]: [],
	};
	const configuredServices = new Set<string>();

	// Configuration-based classification
	for (const [context, serviceNames] of Object.entries(configuration.files)) {
		const runtimeContext = getRuntimeContextFromKey(context);

		if (!runtimeContext) {
			logger.warn(`Unexpected context key: ${context}`);
			continue;
		}

		for (const serviceName of serviceNames)
			if (serviceName in tree) {
				const entry = tree[serviceName];
				if (!isRojoTreeEntry(entry, serviceName)) continue;
				runtimeMap[runtimeContext].push(entry);
				configuredServices.add(serviceName);
				if (entry.$className) configuredServices.add(entry.$className);
			}
	}

	// Fallback classification
	for (const [key, value] of Object.entries(tree)) {
		if (!isRojoTreeEntry(value, key) || configuredServices.has(key)) continue;

		const className = value.$className;
		if (!className || !isRobloxService(className) || configuredServices.has(className)) {
			if (className && !configuredServices.has(className)) runtimeMap[RuntimeContext.Unknown].push(value);
			continue;
		}

		const { runtimeContext } = RobloxServiceMeta[className];
		runtimeMap[runtimeContext].push(value);
	}

	return runtimeMap;
}

function pathMatchesPatternsGlob(path: string, patterns: ReadonlyArray<string>): boolean {
	if (patterns.length === 0) return false;
	for (const pattern of patterns) if (matchesGlob(path, pattern)) return true;
	return false;
}

/**
 * Loads a Rojo project and classifies its entries by runtime context using the
 * given configuration.
 *
 * @param configuration - The Pendant configuration object.
 * @param projectFile - (Optional) Path to the Rojo project file.
 * @returns A tuple: [runtimeEntryMap, rojoProject].
 */
export async function collectFromConfigurationAsync(
	configuration: PendantConfiguration,
	projectFile?: string,
): Promise<readonly [runtimeEntryMap: RuntimeEntryMap, rojoProject: RojoProject]> {
	const rojoProject = await getProjectFromFileAsync(projectFile ?? configuration.projectFile);
	const { tree } = rojoProject;

	const runtimeMap: RuntimeEntryMap = {
		[RuntimeContext.Client]: [],
		[RuntimeContext.Server]: [],
		[RuntimeContext.Shared]: [],
		[RuntimeContext.Testing]: [],
		[RuntimeContext.Unknown]: [],
	};
	const configuredServices = new Set<string>();
	const entries = Object.entries(tree);

	// Configuration-based classification using path patterns
	for (const [key, value] of entries) {
		if (!isRojoTreeEntry(value, key)) continue;

		const className = value.$className;
		const allPaths = extractPathsFromEntry(value);
		let matchedContext: RuntimeContext | undefined;

		// First try to match by service name (for direct service references)
		for (const [context, patterns] of Object.entries(configuration.files)) {
			const runtimeContext = getRuntimeContextFromKey(context);
			if (!runtimeContext) continue;

			// Check if service name matches any pattern directly
			if (patterns.includes(key) || (className && patterns.includes(className))) {
				matchedContext = runtimeContext;
				break;
			}
		}

		// If no service name match, try path-based matching
		if (!matchedContext) {
			for (const path of allPaths) {
				for (const [context, patterns] of Object.entries(configuration.files)) {
					const runtimeContext = getRuntimeContextFromKey(context);
					// eslint-disable-next-line max-depth -- what do you expect me to do?
					if (!runtimeContext) continue;

					// eslint-disable-next-line max-depth -- what do you expect me to do?
					if (pathMatchesPatternsGlob(path, patterns)) {
						matchedContext = runtimeContext;
						break;
					}
				}
				if (matchedContext) break;
			}
		}

		if (matchedContext) {
			runtimeMap[matchedContext].push(value);
			configuredServices.add(key);
			if (className) configuredServices.add(className);
		}
	}

	// Fallback classification for unconfigured services
	for (const [key, value] of entries) {
		if (!isRojoTreeEntry(value, key) || configuredServices.has(key)) continue;

		const className = value.$className;
		if (!className || !isRobloxService(className) || configuredServices.has(className)) {
			if (className && !configuredServices.has(className)) runtimeMap[RuntimeContext.Unknown].push(value);
			continue;
		}

		const { runtimeContext } = RobloxServiceMeta[className];
		runtimeMap[runtimeContext].push(value);
	}

	return [runtimeMap, rojoProject];
}

function extractPathsFromEntry(entry: RojoTreeEntry): ReadonlyArray<string> {
	const paths = new Array<string>();
	let length = 0;

	if (entry.$path) paths[length++] = entry.$path;
	for (const [key, nestedEntry] of Object.entries(entry)) {
		if (!isRojoTreeEntry(nestedEntry, key)) continue;
		for (const path of extractPathsFromEntry(nestedEntry)) paths[length++] = path;
	}

	return paths;
}

/**
 * Extracts all file paths from a runtime entry map, grouped by runtime context.
 *
 * @param runtimeMap - The map from runtime context to tree entries.
 * @returns A map from runtime context to arrays of file paths.
 */
export function collectPathsFromRuntimeMap(runtimeMap: RuntimeEntryMap): RuntimePathMap {
	const paths: Record<RuntimeContext, Array<string>> = {
		[RuntimeContext.Client]: [],
		[RuntimeContext.Server]: [],
		[RuntimeContext.Shared]: [],
		[RuntimeContext.Testing]: [],
		[RuntimeContext.Unknown]: [],
	};

	for (const [context, entries] of Object.entries(runtimeMap)) {
		if (!isRuntimeContext(context)) {
			logger.warn(`Unexpected context key: ${context}`);
			continue;
		}

		const array = paths[context];
		for (const entry of entries) for (const path of extractPathsFromEntry(entry)) array.push(path);
	}

	return paths;
}
