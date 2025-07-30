import { createNamespaceLogger } from "logging/logger-utilities";
import RobloxServiceMeta from "meta/roblox-service-meta";
import RuntimeContext from "meta/runtime-context";
import { basename, join } from "node:path";
import type { PendantConfiguration } from "utilities/configuration-utilities";
import { doesPathExistAsync, fromPathLike, getFilesAsync, writeFileAsync } from "utilities/file-system-utilities";
import { createIgnoreFilterAsync, type IgnoreFilter } from "utilities/gitignore-utilities";
import { prettyJsonStringify } from "utilities/json-utilities";
import { getProjectFromFileAsync, type RojoProject, type RojoTreeEntry } from "utilities/rojo-project-utilities";

const logger = createNamespaceLogger("smart-initialize-async");

// Regex patterns for path consolidation
const GLOB_SUFFIX_PATTERN = /\/\*\*$/;

/**
 * Options for configuring the smart initialization process for a codebase.
 *
 * This interface defines the set of parameters accepted by
 * `smartInitializeAsync` to control how a codebase is initialized, including
 * directory paths, output file naming, and verbosity.
 *
 * @see smartInitializeAsync
 */
export interface SmartInitializeOptions {
	/**
	 * The absolute path to the root of the codebase to initialize.
	 *
	 * This should point to the directory containing the project files and
	 * configuration.
	 */
	readonly codebaseRoot: string;

	/**
	 * An optional path-like value representing the directory in which to
	 * perform initialization.
	 *
	 * If not provided, defaults to the current working directory.
	 */
	readonly directoryPathLike?: Bun.PathLike;

	/**
	 * The name of the output file to generate during initialization.
	 *
	 * Defaults to `"problematic"` if not specified.
	 */
	readonly outputFileName?: string;

	/**
	 * The name of the project file to use for initialization.
	 *
	 * Defaults to `"default.project.json"` if not specified.
	 */
	readonly projectFile?: string;

	/**
	 * Whether to enable verbose logging during initialization.
	 *
	 * If `true`, additional diagnostic information will be logged.
	 */
	readonly verbose?: boolean;
}

/**
 * Maps each runtime context to an array of paths extracted from the Rojo
 * project.
 */
interface RuntimePathsMap {
	readonly client: Array<string>;
	readonly server: Array<string>;
	readonly shared: Array<string>;
	testing?: Array<string>;
}

/**
 * Searches for a Rojo project file in the specified directory and parent
 * directories.
 *
 * @param searchDirectory - The directory to search in.
 * @param projectFileName - The preferred project file name.
 * @returns The discovered project file path.
 * @throws {Error} If no project file is found.
 */
async function findProjectFileAsync(searchDirectory: string, projectFileName: string): Promise<string> {
	const preferredPath = join(searchDirectory, projectFileName);

	// Check if the preferred project file exists in the search directory
	if (await doesPathExistAsync(preferredPath)) return preferredPath;

	// Search for any *.project.json file in the directory
	const files = await getFilesAsync(searchDirectory);
	const projectFiles = files.filter((file) => basename(file).endsWith(".project.json"));

	if (projectFiles.length > 0) {
		// Prioritize default.project.json if it exists
		const defaultProject = projectFiles.find((file) => basename(file) === "default.project.json");
		if (defaultProject) return defaultProject;

		// Return the first project file found
		return projectFiles[0]!;
	}

	throw new Error(`No Rojo project files found in directory: ${searchDirectory}`);
}

/**
 * Consolidates an array of file paths by removing redundant nested patterns.
 *
 * For example, if both "Vendor/Shared/**" and "Vendor/Shared/Base64/**" exist,
 * this function will keep only "Vendor/Shared/**" since it covers the nested
 * path.
 *
 * @param paths - Array of glob patterns to consolidate.
 * @returns Consolidated array with redundant patterns removed.
 */
function consolidatePaths(paths: Array<string>): Array<string> {
	if (paths.length <= 1) return paths;

	// Sort paths by length to process shorter (more general) patterns first
	const sortedPaths = [...paths].sort((a, b) => a.length - b.length);
	const consolidated = new Array<string>();
	let length = 0;

	for (const currentPath of sortedPaths) {
		// Check if this path is already covered by an existing consolidated path
		const isRedundant = consolidated.some((existingPath) => {
			// Remove /** suffix for comparison
			const existingBase = existingPath.replace(GLOB_SUFFIX_PATTERN, "");
			const currentBase = currentPath.replace(GLOB_SUFFIX_PATTERN, "");

			// If current path starts with existing base, it's redundant
			return currentBase.startsWith(`${existingBase}/`) || currentBase === existingBase;
		});

		if (!isRedundant) consolidated[length++] = currentPath;
	}

	// Additional consolidation: if we have multiple paths under Vendor/, consolidate to Vendor/**
	return consolidateVendorPaths(consolidated);
}

/**
 * Consolidates multiple Vendor subdirectory paths into appropriate patterns
 * while preserving runtime context separation.
 *
 * @param paths - Array of glob patterns that may contain Vendor paths.
 * @returns Consolidated array with Vendor paths simplified but context-aware.
 */
function consolidateVendorPaths(paths: Array<string>): Array<string> {
	const vendorPaths = new Array<string>();
	const otherPaths = new Array<string>();
	let vendorSize = 0;
	let otherSize = 0;

	// Separate Vendor paths from other paths
	for (const path of paths)
		if (path.startsWith("Vendor/")) vendorPaths[vendorSize++] = path;
		else otherPaths[otherSize++] = path;

	// Group Vendor paths by their immediate subdirectory (Server, Shared, etc.)
	const vendorGroups = new Map<string, Array<string>>();

	for (const vendorPath of vendorPaths) {
		// Extract the immediate subdirectory (e.g., "Server" from "Vendor/Server/DataStoreService/**")
		const pathParts = vendorPath.replace(GLOB_SUFFIX_PATTERN, "").split("/");
		if (pathParts.length >= 2) {
			/** "Server", "Shared", etc. */
			const vendorSubdir = pathParts[1]!;
			const groupKey = `Vendor/${vendorSubdir}`;

			if (!vendorGroups.has(groupKey)) vendorGroups.set(groupKey, []);
			vendorGroups.get(groupKey)!.push(vendorPath);
		}
	}

	// Consolidate within each Vendor subdirectory group
	const consolidatedVendorPaths = new Array<string>();
	for (const [groupKey, groupPaths] of vendorGroups) {
		// Multiple paths under the same Vendor subdirectory - consolidate to the parent
		// Single path - keep as is
		if (groupPaths.length > 1) consolidatedVendorPaths.push(`${groupKey}/**`);
		else consolidatedVendorPaths.push(...groupPaths);
	}

	return [...otherPaths, ...consolidatedVendorPaths];
}

/**
 * Analyzes a Rojo project tree and groups file paths by runtime context.
 *
 * @param project - The parsed Rojo project.
 * @param ignoreFilter - An ignore filter to test paths against gitignore
 *   patterns.
 * @returns A map of runtime contexts to their associated file paths.
 */
function analyzeRojoProject(project: RojoProject, ignoreFilter?: IgnoreFilter): RuntimePathsMap {
	const paths: RuntimePathsMap = {
		client: [],
		server: [],
		shared: [],
		testing: [],
	};

	/**
	 * Helper function to recursively process entries and classify their paths.
	 *
	 * @param entry - The entry to process.
	 * @param parentKey - The parent key for nested entries.
	 * @param inheritedContext - Runtime context inherited from parent services.
	 */
	function processEntry(entry: RojoTreeEntry, parentKey?: string, inheritedContext?: RuntimeContext): void {
		let runtimeContext: RuntimeContext | undefined = inheritedContext;

		// Determine runtime context from service class name
		if (entry.$className && entry.$className in RobloxServiceMeta) {
			const { runtimeContext: serviceContext } =
				RobloxServiceMeta[entry.$className as keyof typeof RobloxServiceMeta];
			runtimeContext = serviceContext;
		} else if (parentKey && parentKey in RobloxServiceMeta) {
			// Fallback: try to match by key name
			const { runtimeContext: serviceContext } = RobloxServiceMeta[parentKey as keyof typeof RobloxServiceMeta];
			runtimeContext = serviceContext;
		}

		// If this entry has a path, classify it
		if (entry.$path) {
			const globPath = `${entry.$path}/**`;

			switch (runtimeContext) {
				case RuntimeContext.Client: {
					paths.client.push(globPath);
					break;
				}

				case RuntimeContext.Server: {
					paths.server.push(globPath);
					break;
				}

				case RuntimeContext.Shared: {
					paths.shared.push(globPath);
					break;
				}

				case RuntimeContext.Testing: {
					paths.testing ??= [];
					paths.testing.push(globPath);
					break;
				}

				default: {
					// If no specific context is determined, default to shared
					paths.shared.push(globPath);
				}
			}
		}

		// Recursively process nested entries, passing down the runtime context
		for (const [key, nestedEntry] of Object.entries(entry)) {
			if (
				key === "$className" ||
				key === "$ignoreUnknownInstances" ||
				key === "$path" ||
				key === "$properties" ||
				typeof nestedEntry !== "object" ||
				nestedEntry === null ||
				Array.isArray(nestedEntry)
			)
				continue;

			processEntry(nestedEntry as RojoTreeEntry, key, runtimeContext);
		}
	}

	// Iterate through the tree entries and classify them
	for (const [key, entry] of Object.entries(project.tree)) {
		if (
			key === "$className" ||
			key === "$ignoreUnknownInstances" ||
			key === "$path" ||
			key === "$properties" ||
			typeof entry !== "object" ||
			entry === null ||
			Array.isArray(entry)
		)
			continue;

		processEntry(entry as RojoTreeEntry, key, undefined);
	}

	// Consolidate paths to remove redundant nested patterns
	let consolidatedPaths: RuntimePathsMap = {
		client: consolidatePaths(paths.client),
		server: consolidatePaths(paths.server),
		shared: consolidatePaths(paths.shared),
		testing: consolidatePaths(paths.testing ?? []),
	};

	// Filter out paths that match gitignore patterns
	if (ignoreFilter)
		// Create a new object with filtered paths using the ignore package
		consolidatedPaths = {
			client: consolidatedPaths.client.filter((path) => !isIgnoredPath(path, ignoreFilter)),
			server: consolidatedPaths.server.filter((path) => !isIgnoredPath(path, ignoreFilter)),
			shared: consolidatedPaths.shared.filter((path) => !isIgnoredPath(path, ignoreFilter)),
			testing: consolidatedPaths.testing?.filter((path) => !isIgnoredPath(path, ignoreFilter)),
		};

	return consolidatedPaths;
}

/**
 * Checks if a path should be ignored using the ignore package.
 *
 * @param path - The path to check.
 * @param ignoreFilter - The ignore filter instance.
 * @returns True if the path should be ignored.
 */
function isIgnoredPath(path: string, ignoreFilter: IgnoreFilter): boolean {
	// Remove /** suffix to get the base path for testing
	const basePath = path.replace(GLOB_SUFFIX_PATTERN, "");

	// Test both as directory and file since ignore is strict about this
	// For directory patterns like "/Packages/", we need to test "Packages" as a directory
	const asDirectory = `${basePath}/`;

	// Test if the path should be ignored (try both file and directory formats)
	return ignoreFilter.ignores(basePath) || ignoreFilter.ignores(asDirectory);
}

/**
 * Intelligently generates a `pendant.json` configuration file based on an
 * existing Rojo project structure.
 *
 * This function scans the codebase for a Rojo project file, analyzes its tree
 * structure, and automatically generates a Pendant configuration with
 * appropriate file paths grouped by runtime context.
 *
 * @example
 *
 * ```typescript
 * await smartInitializeAsync({
 * 	codebaseRoot: "/path/to/roblox/project",
 * 	outputFileName: "problematic",
 * 	verbose: true,
 * });
 * ```
 *
 * @param options - Configuration options for the smart initialization process.
 * @throws {Error} If no Rojo project file is found in the codebase root.
 * @throws {Error} If the project file cannot be parsed or is invalid.
 */
export default async function smartInitializeAsync({
	codebaseRoot,
	directoryPathLike = process.cwd(),
	outputFileName = "problematic",
	projectFile = "default.project.json",
	verbose = false,
}: SmartInitializeOptions): Promise<void> {
	const directoryPath = fromPathLike(directoryPathLike);

	if (verbose) {
		logger.info(`Starting smart initialization for codebase: ${codebaseRoot}`);
		logger.info(`Working directory: ${directoryPath}`);
		logger.info(`Preferred project file: ${projectFile}`);
	}

	// Step 1: Locate and load the Rojo project file
	const projectFilePath = await findProjectFileAsync(directoryPath, projectFile);
	const discoveredProjectFileName = basename(projectFilePath);
	if (verbose) logger.info(`Found Rojo project file: ${projectFilePath}`);

	// Step 2: Load and parse the Rojo project
	const rojoProject = await getProjectFromFileAsync(projectFilePath);
	if (verbose) logger.info(`Loaded Rojo project: ${rojoProject.name}`);

	// Step 3: Load gitignore patterns if available
	const ignoreFilter = await createIgnoreFilterAsync(join(codebaseRoot, ".gitignore"));
	if (verbose) logger.info("Loaded gitignore patterns for filtering");

	// Step 4: Analyze the project tree and group paths by runtime context
	const runtimePaths = analyzeRojoProject(rojoProject, ignoreFilter);

	if (verbose) {
		logger.info("Analyzed project structure:");
		logger.info(`  Client paths: ${runtimePaths.client.length}`);
		logger.info(`  Server paths: ${runtimePaths.server.length}`);
		logger.info(`  Shared paths: ${runtimePaths.shared.length}`);
		if (runtimePaths.testing && runtimePaths.testing.length > 0)
			logger.info(`  Testing paths: ${runtimePaths.testing.length}`);
	}

	// Step 4: Generate the Pendant configuration
	const configuration: PendantConfiguration & { $schema: string } = {
		$schema: "./.schemas/pendant-configuration.schema.json",
		files: {
			client: runtimePaths.client,
			server: runtimePaths.server,
			shared: runtimePaths.shared,
			...(runtimePaths.testing && runtimePaths.testing.length > 0 ? { testing: runtimePaths.testing } : {}),
		},
		ignoreGlobs: ["Packages/**", "ServerPackages/**", "DevPackages/**", "Vendor/**", "VendorServer/**"],
		outputFileName,
		projectFile: discoveredProjectFileName,
	};

	// Step 5: Write the configuration file to disk
	const configurationPath = join(directoryPath, "pendant.json");
	const formattedJson = prettyJsonStringify(configuration, {
		indent: "\t",
		indentLevel: 0,
	});

	await writeFileAsync(configurationPath, formattedJson);

	if (verbose) {
		logger.info(`Generated Pendant configuration at: ${configurationPath}`);
		logger.info(`Configuration contents:\n${formattedJson}`);
	} else logger.info(`Generated pendant.json configuration for ${rojoProject.name}`);
}
