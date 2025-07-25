import chalk from "chalk";
import { createNamespaceLogger } from "logging/logger-utilities";
import { parseGitignoreAsync } from "utilities/gitignore-utilities";
import { addQuoted, removeQuotes } from "utilities/string-utilities";

const logger = createNamespaceLogger("luau-lsp-runner");

/** Options for configuring the Luau LSP analysis. */
export interface LuauLspAnalysisOptions {
	/** Optional path to the base .luaurc configuration file. */
	readonly baseConfigPath?: string;
	/** Optional path to the definitions file (e.g., globalTypes.d.luau). */
	readonly definitionsPath?: string;
	/**
	 * Optional list of glob patterns to ignore during analysis. If not
	 * provided, .gitignore patterns will be used as defaults.
	 */
	readonly ignorePatterns?: ReadonlyArray<string>;
	/** The paths to analyze. */
	readonly paths: ReadonlyArray<string>;
	/** Optional path to the settings file (e.g., .vscode/settings.json). */
	readonly settingsPath?: string;
	/** Optional path to the sourcemap file. */
	readonly sourcemapPath?: string;
	/** Optional timeout for the analysis in milliseconds. */
	readonly timeout?: number;
	/** Optional flag to enable verbose logging. */
	readonly verbose?: boolean;
}

/** Represents the result of a Luau LSP analysis execution. */
export interface LuauLspResult {
	/** The exit code of the luau-lsp process. */
	readonly exitCode: number;
	/** The content of the stderr stream from the luau-lsp process. */
	readonly stderr: string;
	/** The content of the stdout stream from the luau-lsp process. */
	readonly stdout: string;
	/** Indicates whether the analysis was successful (exit code 0). */
	readonly success: boolean;
}

export interface PrivateLuauLspRunner {
	buildCommandAsync(options: LuauLspAnalysisOptions): Promise<ReadonlyArray<string>>;
}

function isString(value: string | undefined): value is string {
	return value !== undefined;
}

/** Core runner for luau-lsp analyze command. */
export class LuauLspRunner {
	/**
	 * Executes luau-lsp analyze on the specified paths.
	 *
	 * @param options - Analysis options including paths, definitions, and
	 *   settings.
	 * @returns Promise resolving to the analysis result.
	 */
	public async executeAnalysisAsync(options: LuauLspAnalysisOptions): Promise<LuauLspResult> {
		const command = await this.buildCommandAsync(options);
		if (options.verbose) logger.debug(`Executing: ${command.join(" ")}`);

		try {
			const subprocess = Bun.spawn([...command], {
				cwd: this.cwd,
				stderr: "pipe",
				stdout: "pipe",
			});

			const exitCode = await subprocess.exited;
			const stdout = await new Response(subprocess.stdout).text();
			const stderr = await new Response(subprocess.stderr).text();

			return {
				exitCode,
				stderr,
				stdout,
				success: exitCode === 0,
			};
		} catch (error) {
			logger.error(`Failed to execute luau-lsp: ${error}`);
			return {
				exitCode: -1,
				stderr: String(error),
				stdout: "",
				success: false,
			};
		}
	}

	/**
	 * Creates an instance of LuauLspRunner.
	 *
	 * @param cwd - The current working directory for executing luau-lsp
	 *   commands. Defaults to `process.cwd()`.
	 */
	public constructor(private readonly cwd: string = process.cwd()) {}

	/**
	 * Builds the luau-lsp analyze command arguments.
	 *
	 * @param options - Analysis options including paths, definitions, and
	 *   settings.
	 * @returns Array of command-line arguments for luau-lsp analyze.
	 */
	private async buildCommandAsync(options: LuauLspAnalysisOptions): Promise<ReadonlyArray<string>> {
		const command = [
			"luau-lsp",
			"analyze",
			`--definitions=${options.definitionsPath ?? "globalTypes.d.luau"}`,
			"--no-strict-dm-types",
		];

		const settingsPath = options.settingsPath ?? ".vscode/settings.json";
		if (await Bun.file(`${this.cwd}/${settingsPath}`).exists()) command.push(`--settings=${settingsPath}`);

		const sourcemapPath = options.sourcemapPath ?? "sourcemap.json";
		if (await Bun.file(`${this.cwd}/${sourcemapPath}`).exists()) command.push(`--sourcemap=${sourcemapPath}`);

		const baseConfigPath = options.baseConfigPath ?? ".luaurc";
		if (await Bun.file(`${this.cwd}/${baseConfigPath}`).exists()) command.push(`--base-luaurc=${baseConfigPath}`);

		// Combine gitignore patterns with custom ignore patterns
		const gitignorePatterns = await parseGitignoreAsync(`${this.cwd}/.gitignore`);
		const patterns = [...gitignorePatterns, ...(options.ignorePatterns ?? [])];

		const results = await Promise.all(
			patterns.map(async (pattern) => {
				const iterator = new Bun.Glob(pattern).scan({ cwd: this.cwd });
				const { done } = await iterator.next();
				return done ? undefined : pattern;
			}),
		);

		// Add all ignore patterns
		for (const pattern of results.filter(isString)) command.push(`--ignore=${addQuoted(removeQuotes(pattern))}`);

		// Add target paths
		command.push(...options.paths);

		if (options.verbose) logger.info(`Final command:\n${chalk.bold(command.join(" "))}`);

		return command;
	}
}

/**
 * Downloads globalTypes.d.luau from the official repository.
 *
 * @param targetPath - Path to save the downloaded file (default:
 *   "globalTypes.d.luau").
 * @returns Promise resolving when download is complete.
 * @throws Error if download fails.
 */
export async function downloadGlobalTypesAsync(targetPath = "globalTypes.d.luau"): Promise<void> {
	const url = "https://raw.githubusercontent.com/JohnnyMorganz/luau-lsp/main/scripts/globalTypes.d.luau";

	try {
		logger.info("Downloading globalTypes.d.luau...");
		const response = await Bun.fetch(url);

		if (!response.ok) throw new Error(`Failed to download: ${response.status} ${response.statusText}`);

		const content = await response.text();
		await Bun.write(targetPath, content);
		logger.info("Successfully downloaded globalTypes.d.luau");
	} catch (error) {
		logger.error(`Failed to download globalTypes.d.luau: ${error}`);
		throw error;
	}
}

/**
 * Generates a sourcemap using Rojo.
 *
 * @param projectFile - The path to the Rojo project file (e.g.,
 *   "default.project.json"). Defaults to "default.project.json".
 * @param outputPath - The path where the generated sourcemap will be saved.
 *   Defaults to "sourcemap.json".
 * @returns A Promise that resolves when the sourcemap generation is complete.
 * @throws Error if Rojo sourcemap generation fails.
 */
export async function generateSourcemapAsync(
	projectFile = "default.project.json",
	outputPath = "sourcemap.json",
): Promise<void> {
	try {
		logger.debug(`Generating sourcemap from ${projectFile}...`);

		const subprocess = Bun.spawn(["rojo", "sourcemap", "--output", outputPath, projectFile], {
			stderr: "pipe",
			stdout: "pipe",
		});

		const exitCode = await subprocess.exited;

		if (exitCode !== 0) {
			const stderr = await new Response(subprocess.stderr).text();
			throw new Error(`Rojo sourcemap generation failed: ${stderr}`);
		}

		logger.debug("Sourcemap generated successfully");
	} catch (error) {
		logger.error(`Failed to generate sourcemap: ${error}`);
		throw error;
	}
}
