import { createNamespaceLogger } from "logging/logger-utilities";
import type RobloxService from "meta/roblox-service";
import RobloxServiceMeta from "meta/roblox-service-meta";
import RuntimeContext from "meta/runtime-context";
import RuntimeContextMeta from "meta/runtime-context-meta";
import { basename, resolve } from "node:path";
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
export type RojoTreeEntry = BaseRojoTreeEntry & { readonly [key: string]: RojoTreeEntry };

export interface RojoProject {
	readonly gameId?: number;
	readonly globIgnorePaths?: ReadonlyArray<string>;
	readonly name: string;
	readonly placeId?: number;
	readonly serveAddress?: string;
	readonly servePlaceIds?: ReadonlyArray<number>;
	readonly servePort?: number;
	readonly tree: RojoTreeEntry;
}

const PROJECT_JSON_GLOB = new Bun.Glob("*.project.json");

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

export type RuntimeEntryMap = Record<RuntimeContext, Array<RojoTreeEntry>>;
export type RuntimePathMap = Record<RuntimeContext, Array<string>>;

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

		for (const serviceName of serviceNames) {
			if (serviceName in tree) {
				const entry = tree[serviceName];
				if (!isRojoTreeEntry(entry, serviceName)) continue;
				runtimeMap[runtimeContext].push(entry);
				configuredServices.add(serviceName);
				// Also track by className to prevent fallback classification
				if (entry.$className) {
					configuredServices.add(entry.$className);
				}
			}
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

	// Configuration-based classification
	for (const [context, serviceNames] of Object.entries(configuration.files)) {
		const runtimeContext = getRuntimeContextFromKey(context);

		if (!runtimeContext) {
			logger.warn(`Unexpected context key: ${context}`);
			continue;
		}

		for (const serviceName of serviceNames) {
			if (serviceName in tree) {
				const entry = tree[serviceName];
				if (!isRojoTreeEntry(entry, serviceName)) continue;
				runtimeMap[runtimeContext].push(entry);
				configuredServices.add(serviceName);
				if (entry.$className) configuredServices.add(entry.$className);
			}
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
		for (const entry of entries) for (const path of extractPathsFromEntry(entry)) array.push(resolve(path));
	}

	return paths;
}
