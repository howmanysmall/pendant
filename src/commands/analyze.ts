import { defineCommand, option } from "@bunli/core";

import AnalysisCoordinator from "core/analysis-coordinator";
import { createNamespaceLogger } from "logging/logger-utilities";
import type RuntimeContext from "meta/runtime-context";
import {
	getFirstConfigurationAsync,
	getPendantConfigurationAsync,
	type PendantConfiguration,
} from "utilities/configuration-utilities";
import { collectFromConfigurationAsync, collectPathsFromRuntimeMap } from "utilities/rojo-project-utilities";
import { z } from "zod/v4-mini";

const logger = createNamespaceLogger("analyze");

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

			const paths = collectPathsFromRuntimeMap(runtimeMap);
			commandSpinner.stop();

			if (verbose) {
				logger.info(`Project name: ${rojoProject.name}`);
				logger.info(`Runtime paths: ${Bun.inspect(paths, { colors: true, compact: false })}`);
			}

			// Initialize analysis coordinator
			const coordinator = new AnalysisCoordinator();

			// Ensure prerequisites (globalTypes.d.luau)
			commandSpinner.start(colors.blue("Checking prerequisites..."));
			await coordinator.ensurePrerequisitesAsync(grab);
			commandSpinner.stop();

			// Build ignore patterns
			const ignorePatterns = configuration.ignoreGlobs ?? [];
			if (verbose && ignorePatterns.length > 0) {
				logger.info(`Added ${ignorePatterns.length} problematic file patterns to ignore list`);
			}

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
