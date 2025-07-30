import { defineCommand, option } from "@bunli/core";

import AnalysisCoordinator from "core/analysis-coordinator";
import { createNamespaceLogger } from "logging/logger-utilities";
import GitHubDownloadType from "meta/github-download-type";
import type RuntimeContext from "meta/runtime-context";
import micromatch from "micromatch";
import {
	getFirstConfigurationAsync,
	getPendantConfigurationAsync,
	type PendantConfiguration,
} from "utilities/configuration-utilities";
import {
	collectFromConfigurationAsync,
	collectPathsFromRuntimeMap,
	type RuntimePathMap,
} from "utilities/rojo-project-utilities";
import { z } from "zod/v4-mini";

const logger = createNamespaceLogger("analyze");

// Regex patterns for path consolidation

function filterPathsWithIgnorePatterns(
	paths: RuntimePathMap,
	ignoreGlobs: ReadonlyArray<string>,
	workingDirectory: string,
): RuntimePathMap {
	const filtered: RuntimePathMap = {} as RuntimePathMap;

	for (const [context, pathList] of Object.entries(paths) as Array<[RuntimeContext, Array<string>]>)
		filtered[context] = micromatch.not(
			pathList,
			ignoreGlobs.map((pattern) => `**/${pattern}`),
			{
				cwd: workingDirectory,
			},
		);

	return filtered;
}

async function getConfigurationAsync(configurationFile?: string): Promise<PendantConfiguration> {
	if (configurationFile) {
		const exists = await Bun.file(configurationFile).exists();
		if (exists) return getPendantConfigurationAsync(configurationFile);
	}

	return getFirstConfigurationAsync();
}

function determineFetchType(
	flag: GitHubDownloadType | undefined,
	configuration: GitHubDownloadType | undefined,
): GitHubDownloadType {
	if ("GITHUB_TOKEN" in Bun.env) return GitHubDownloadType.OctokitCore;
	return flag ?? configuration ?? GitHubDownloadType.Fetch;
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
			const fetchType = determineFetchType(flags.fetchType, configuration.fetchType);

			if (verbose) {
				logger.info(`Configuration: ${Bun.inspect(configuration, { colors: true, compact: true })}`);
				logger.info(`Output file: ${outputFile}`);
				logger.info(`Project file: ${projectFile}`);
			}

			// Load Rojo project and collect paths
			commandSpinner.start(colors.blue("Loading Rojo project configuration..."));

			const [runtimeMap, rojoProject] = await collectFromConfigurationAsync(configuration, projectFile);

			// Apply gitignore and ignoreGlobs filtering
			const ignoreGlobs = configuration.ignoreGlobs ?? [];
			const paths = filterPathsWithIgnorePatterns(
				collectPathsFromRuntimeMap(runtimeMap),
				ignoreGlobs,
				process.cwd(),
			);

			commandSpinner.stop();

			if (verbose) {
				logger.info(`Project name: ${rojoProject.name}`);
				logger.info(`Runtime paths: ${Bun.inspect(paths, { colors: true, compact: false })}`);
			}

			// Initialize analysis coordinator
			const coordinator = new AnalysisCoordinator();

			// Ensure prerequisites (globalTypes.d.luau)
			commandSpinner.start(colors.blue("Checking prerequisites..."));
			await coordinator.ensurePrerequisitesAsync(fetchType, grab, verbose);
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
		fetchType: option(z.optional(z.enum([GitHubDownloadType.Fetch, GitHubDownloadType.OctokitCore])), {
			description: "Specifies the method for downloading files from GitHub.",
			short: "f",
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
