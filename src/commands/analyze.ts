import { defineCommand, option } from "@bunli/core";

import AnalysisCoordinator from "core/analysis-coordinator";
import { createNamespaceLogger } from "logging/logger-utilities";
import type RuntimeContext from "meta/runtime-context";
import { relative } from "node:path";
import {
	getFirstConfigurationAsync,
	getPendantConfigurationAsync,
	type PendantConfiguration,
} from "utilities/configuration-utilities";
import { createIgnoreFilterAsync, createSimpleIgnoreFilter, type IgnoreFilter } from "utilities/gitignore-utilities";
import {
	collectFromConfigurationAsync,
	collectPathsFromRuntimeMap,
	type RuntimePathMap,
} from "utilities/rojo-project-utilities";
import { z } from "zod/v4-mini";

const logger = createNamespaceLogger("analyze");

// Regex patterns for path consolidation
const GLOB_SUFFIX_PATTERN = /\/\*\*$/;

/**
 * Checks if a path should be ignored based on gitignore patterns.
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
 * Filters paths using gitignore and configuration ignore patterns.
 *
 * @param paths - The runtime paths map to filter.
 * @param ignoreFilter - The gitignore filter function.
 * @param ignoreGlobs - Additional glob patterns to ignore from configuration.
 * @param workingDirectory - The working directory to make paths relative to.
 * @returns Filtered runtime paths map.
 */
function filterPathsWithIgnorePatterns(
	paths: RuntimePathMap,
	ignoreFilter: IgnoreFilter,
	ignoreGlobs: ReadonlyArray<string>,
	workingDirectory: string,
): RuntimePathMap {
	const filtered: RuntimePathMap = {} as RuntimePathMap;

	// Create a combined ignore filter that includes both gitignore and ignoreGlobs
	const combinedIgnoreFilter = createSimpleIgnoreFilter();
	combinedIgnoreFilter.add(ignoreGlobs);

	for (const [context, pathList] of Object.entries(paths) as Array<[RuntimeContext, Array<string>]>) {
		filtered[context] = pathList.filter((path) => {
			const relativePath = relative(workingDirectory, path);

			// Also try extracting just the directory structure from the path
			// For paths like /Users/.../drawing/VendorServer/... we want VendorServer/...
			const pathSegments = path.split("/");
			const popped = workingDirectory.split("/").pop();
			if (!popped) return false; // If no popped segment, skip

			const projectDirectoryIndex = pathSegments.indexOf(popped);
			const relativeFromProject =
				projectDirectoryIndex >= 0 && projectDirectoryIndex < pathSegments.length - 1
					? pathSegments.slice(projectDirectoryIndex + 1).join("/")
					: relativePath;

			// Check against gitignore patterns
			if (isIgnoredPath(relativePath, ignoreFilter)) return false;
			if (isIgnoredPath(relativeFromProject, ignoreFilter)) return false;

			// Check against ignoreGlobs patterns
			if (combinedIgnoreFilter.ignores(relativePath)) return false;
			return !combinedIgnoreFilter.ignores(relativeFromProject);
		});
	}

	return filtered;
}

async function getConfigurationAsync(configurationFile?: string): Promise<PendantConfiguration> {
	if (configurationFile) {
		const exists = await Bun.file(configurationFile).exists();
		if (exists) return getPendantConfigurationAsync(configurationFile);
	}

	return getFirstConfigurationAsync();
}

export const analyzeCommand = defineCommand({
	name: "analyze",
	description: "Analyzes the project using luau-lsp with runtime context awareness.",
	handler: async ({ colors, flags, spinner }) => {
		const { configurationFile, grab, timeout, verbose, watch } = flags;
		const commandSpinner = spinner();

		try {
			// Load configuration
			commandSpinner.start(colors.blue("Loading pendant configuration..."));
			const configuration = await getConfigurationAsync(configurationFile);
			commandSpinner.stop();

			// Resolve project settings
			const outputFile = flags.outputFile ?? configuration.outputFileName ?? "problematic";
			const projectFile = flags.rojoProject ?? configuration.projectFile ?? "default.project.json";

			if (verbose) {
				logger.info(`Configuration: ${Bun.inspect(configuration, { colors: true, compact: true })}`);
				logger.info(`Output file: ${outputFile}`);
				logger.info(`Project file: ${projectFile}`);
			}

			// Load Rojo project and collect paths
			commandSpinner.start(colors.blue("Loading Rojo project configuration..."));

			const [runtimeMap, rojoProject] = await collectFromConfigurationAsync(configuration, projectFile);

			let paths = collectPathsFromRuntimeMap(runtimeMap);

			// Apply gitignore and ignoreGlobs filtering
			const ignoreFilter = await createIgnoreFilterAsync();
			const ignoreGlobs = configuration.ignoreGlobs ?? [];
			paths = filterPathsWithIgnorePatterns(paths, ignoreFilter, ignoreGlobs, process.cwd());

			commandSpinner.stop();

			if (verbose) {
				logger.info(`Project name: ${rojoProject.name}`);
				logger.info(`Runtime paths: ${Bun.inspect(paths, { colors: true, compact: false })}`);
			}

			// Initialize analysis coordinator
			const coordinator = new AnalysisCoordinator();

			// Ensure prerequisites (globalTypes.d.luau)
			commandSpinner.start(colors.blue("Checking prerequisites..."));
			await coordinator.ensurePrerequisitesAsync(grab, verbose);
			commandSpinner.stop();

			// Build ignore patterns
			const ignorePatterns = configuration.ignoreGlobs ?? [];
			if (verbose && ignorePatterns.length > 0)
				logger.info(`Added ${ignorePatterns.length} problematic file patterns to ignore list`);

			const analysisOptions = {
				ignorePatterns,
				outputFile,
				paths: new Map(Object.entries(paths)) as Map<RuntimeContext, ReadonlyArray<string>>,
				projectFile,
				timeout,
				verbose,
				watch,
			};

			if (watch) {
				logger.info("Starting watch mode...");
				await coordinator.startWatchModeAsync(analysisOptions);
			} else {
				commandSpinner.start(colors.blue("Running analysis..."));
				await coordinator.runAnalysisAsync(analysisOptions);
				commandSpinner.stop("Analysis completed!");
				commandSpinner.stop();
			}
		} catch (error) {
			commandSpinner.stop();
			logger.error(`Analysis failed: ${error}`);
			process.exit(1);
		}
	},
	options: {
		configurationFile: option(z.optional(z.string()), {
			description: "The configuration file to use for the analysis.",
			short: "c",
		}),
		grab: option(z._default(z.boolean(), false), {
			description: "Grabs the latest globalTypes.d.luau file.",
			short: "g",
		}),
		outputFile: option(z.optional(z.string()), {
			description: "The output file to use. Will usually be extracted via the .pendant.json file.",
		}),
		rojoProject: option(z.optional(z.string()), {
			description: "The Rojo project file to use. Will usually be extracted via the .pendant.json file.",
		}),
		timeout: option(z.optional(z.number().check(z.gt(0))), {
			description: "Sets a timeout for the analysis.",
			short: "t",
		}),
		verbose: option(z._default(z.boolean(), false), {
			description: "Outputs more information.",
			short: "V",
		}),
		watch: option(z._default(z.boolean(), false), {
			description: "Watches for file changes.",
			short: "w",
		}),
	},
});

export default analyzeCommand;
