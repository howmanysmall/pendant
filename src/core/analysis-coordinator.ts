import { watch } from "chokidar";
import downloadGlobalTypesAsync from "functions/download-global-types-async";
import { createNamespaceLogger } from "logging/logger-utilities";
import GitHubDownloadType from "meta/github-download-type";
import type RuntimeContext from "meta/runtime-context";
import { join } from "node:path";
import { bunPerformanceNow } from "utilities/performance-utilities";

import { generateSourcemapAsync, LuauLspRunner } from "./luau-lsp-runner";
import {
	type ContextAnalysisResult,
	formatAnalysisResults,
	formatPerformanceInfo,
	parseLuauLspOutput,
} from "./output-formatter";

const logger = createNamespaceLogger("analysis-coordinator");

function updateStringBuilder(
	stringBuilder: ReadonlyArray<string>,
	duration: number,
	watchMode = false,
): ReadonlyArray<string> {
	const firstMessage = stringBuilder[0];
	if (firstMessage !== undefined) {
		const timerOutput = watchMode
			? `Finished in ${formatPerformanceInfo(duration)}.`
			: `Completed in ${formatPerformanceInfo(duration)}.`;

		return [`${firstMessage} ${timerOutput}`, ...stringBuilder.slice(1)];
	}

	return stringBuilder;
}

/** Defines the options for the analysis process. */
export interface AnalysisOptions {
	/** Optional list of glob patterns to ignore during analysis. */
	readonly ignorePatterns?: ReadonlyArray<string>;
	/** The path to the output file where analysis problems will be written. */
	readonly outputFile: string;
	/**
	 * A map where keys are `RuntimeContext` and values are arrays of file paths
	 * to analyze within that context.
	 */
	readonly paths: ReadonlyMap<RuntimeContext, ReadonlyArray<string>>;
	/** The path to the Rojo project file (e.g., "default.project.json"). */
	readonly projectFile: string;
	/** Optional timeout for the luau-lsp analysis in milliseconds. */
	readonly timeout?: number;
	/** Optional flag to enable verbose logging for the analysis process. */
	readonly verbose?: boolean;
	/** Optional flag indicating whether the analysis is running in watch mode. */
	readonly watchMode?: boolean;
}

/** Defines the options for initializing the AnalysisCoordinator. */
export interface AnalysisCoordinatorOptions {
	/**
	 * The current working directory for executing commands. Defaults to
	 * `process.cwd()`.
	 */
	readonly cwd?: string;
	/**
	 * The source directory to watch for changes. Defaults to `join(cwd,
	 * "src")`.
	 */
	readonly sourceDirectory?: string;
}

const consoleInfo = console.info;
const IGNORE_DOT_FILES_REGEX = /(^|[/\\])\../;

/**
 * Coordinates analysis across multiple runtime contexts, managing luau-lsp
 * execution, sourcemap generation, and watch mode functionality.
 */
export default class AnalysisCoordinator {
	/**
	 * Ensures that all prerequisites for analysis are met, such as the
	 * existence of `globalTypes.d.luau`. Downloads `globalTypes.d.luau` if it's
	 * missing or if `grab` is true.
	 *
	 * @param gitHubDownloadType - The type of GitHub download to use for
	 *   downloading `globalTypes.d.luau`.
	 * @param grab - If true, forces a re-download of `globalTypes.d.luau` even
	 *   if it exists.
	 * @param verbose - If true, enables verbose logging during the download.
	 * @returns A Promise that resolves when the prerequisites are ensured.
	 */
	public async ensurePrerequisitesAsync(
		gitHubDownloadType: GitHubDownloadType,
		grab = false,
		verbose = false,
	): Promise<void> {
		const globalTypesPath = join(this.cwd, "globalTypes.d.luau");
		const globalTypesFile = Bun.file(globalTypesPath);

		if (grab || !(await globalTypesFile.exists())) {
			try {
				await downloadGlobalTypesAsync(gitHubDownloadType, globalTypesPath, verbose);
			} catch {
				try {
					const otherType =
						gitHubDownloadType === GitHubDownloadType.Fetch
							? GitHubDownloadType.OctokitCore
							: GitHubDownloadType.Fetch;
					await downloadGlobalTypesAsync(otherType, globalTypesPath, verbose);
				} catch (error) {
					logger.error(`Failed to download globalTypes.d.luau: ${error}`);
					throw new Error("Failed to ensure prerequisites: globalTypes.d.luau could not be downloaded.");
				}
			}
		}
	}

	/**
	 * Executes a single analysis run based on the provided options. This method
	 * generates a sourcemap, runs luau-lsp for each specified context, formats
	 * the results, and writes them to an output file.
	 *
	 * @param options - Options that control how the analysis is performed, such
	 *   as paths, output file, and verbosity.
	 * @returns A Promise that resolves when the analysis is complete.
	 * @throws Error if the analysis fails at any stage.
	 */
	public async runAnalysisAsync(options: AnalysisOptions): Promise<void> {
		const startTime = bunPerformanceNow();

		// Cancel any previous analysis
		if (this.lastPromise) this.lastPromise = undefined;

		try {
			// Generate sourcemap
			if (options.verbose) logger.info("Generating sourcemap...");
			await generateSourcemapAsync(options.projectFile);
			if (options.verbose) logger.info("Sourcemap generated");

			// Pre-allocate results array for better performance
			const results = new Array<ContextAnalysisResult>();
			const contextEntries = Array.from(options.paths.entries());

			// Run analysis for each context in parallel where possible
			const analysisPromises = contextEntries
				.filter(([, paths]) => paths.length > 0)
				.map(async ([context, paths]) => {
					if (options.verbose) logger.debug(`Analyzing ${context} context: ${paths.length} paths`);

					const result = await this.lspRunner.executeAnalysisAsync({
						ignorePatterns: options.ignorePatterns,
						paths: Array.from(paths),
						timeout: options.timeout,
						verbose: options.verbose,
					});

					// Parse issues from output
					const output = result.stdout || result.stderr;
					const issues = parseLuauLspOutput(output, options.ignorePatterns);

					if (!result.success && options.verbose)
						logger.warn(`Analysis failed for ${context} context (exit code: ${result.exitCode})`);

					return {
						context,
						issues,
						rawOutput: output,
					} as ContextAnalysisResult;
				});

			// Wait for all analysis to complete
			const analysisResults = await Promise.all(analysisPromises);
			results.push(...analysisResults);

			// Format and display results
			const { problemsFileContent, stringBuilder } = formatAnalysisResults(results, options.watchMode);
			const duration = bunPerformanceNow() - startTime;

			// Write problems file only if content changed (optimization for watch mode)
			if (this.lastProblematicContent !== problemsFileContent) {
				this.lastProblematicContent = problemsFileContent;
				await Bun.write(options.outputFile, problemsFileContent);
			}

			// Display results
			const finalOutput = updateStringBuilder(stringBuilder, duration, options.watchMode).join("\n");
			consoleInfo(finalOutput);
		} catch (error) {
			const duration = bunPerformanceNow() - startTime;
			logger.error(`Analysis failed after ${duration.toFixed(2)}ms: ${error}`);
			throw error;
		}
	}

	/**
	 * Starts the analysis in watch mode. This method continuously monitors the
	 * source directory for file changes and triggers a new analysis run
	 * whenever a change is detected.
	 *
	 * @param options - The analysis options to use for each run in watch mode.
	 * @returns A Promise that never resolves, keeping the process alive for
	 *   watch mode.
	 */
	public async startWatchModeAsync(options: AnalysisOptions): Promise<void> {
		logger.info(`Starting watch mode for ${this.sourceDirectory}...`);

		const watcher = watch([this.sourceDirectory], {
			ignored: IGNORE_DOT_FILES_REGEX,
			ignoreInitial: true,
			persistent: true,
		});

		const runAnalysisAsync = async (): Promise<void> => {
			try {
				await this.runAnalysisAsync({ ...options, watchMode: true });
			} catch (error) {
				logger.error(`Watch mode analysis failed: ${error}`);
			}
		};

		// Initial analysis
		await runAnalysisAsync();

		function runAnalysis(): void {
			void runAnalysisAsync();
		}

		watcher
			.on("add", runAnalysis)
			.on("change", runAnalysis)
			.on("unlink", runAnalysis)
			.on("unlinkDir", runAnalysis)
			.on("error", (error) => logger.error(`Watcher error: ${error}`))
			.on("ready", () => logger.info(`✓ Watching for changes in ${this.sourceDirectory}`));

		/** Handle graceful shutdown. */
		const cleanup = (): void => {
			logger.info("Shutting down watcher...");
			void watcher.close().then(() => {
				logger.info("✓ Watcher stopped.");
				process.exit(0);
			});
		};

		process.on("SIGINT", cleanup);
		process.on("SIGTERM", cleanup);

		// Keep process alive
		return new Promise(() => {
			// This promise never resolves to keep the process running
		});
	}

	public constructor({ cwd, sourceDirectory }: AnalysisCoordinatorOptions = {}) {
		this.cwd = cwd ?? process.cwd();
		this.sourceDirectory = sourceDirectory ?? join(this.cwd, "src");
		this.lspRunner = new LuauLspRunner(this.cwd);
	}

	private readonly cwd: string;
	private lastProblematicContent?: string;
	private lastPromise?: Promise<void>;
	private readonly lspRunner: LuauLspRunner;
	private readonly sourceDirectory: string;
}
