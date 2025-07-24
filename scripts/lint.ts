#!/usr/bin/env bun

import chalk from "chalk";
import { basename, join } from "node:path";

import parseArguments, { OptionType, type ParsedArguments, type Schema } from "./utilities/parse-arguments";
import scriptConsole from "./utilities/script-console";

const DEFAULT_FILES = join(process.cwd(), "src");
// const TSCONFIG_PATH = join(process.cwd(), "tsconfig.json");

const enum ReporterType {
	GitHub = "github",
	GitLab = "gitlab",
	Json = "json",
	JsonPretty = "json-pretty",
	JUnit = "junit",
	Summary = "summary",
}

const SCHEMA = {
	"error-on-warnings": {
		default: false,
		description: "Tell Biome to exit with an error code if some diagnostics emit warnings.",
		type: OptionType.Boolean,
	},
	files: {
		default: DEFAULT_FILES,
		description: "The files to run the linting on.",
		type: OptionType.String,
	},
	fix: {
		default: false,
		description: "Automatically fix linting issues where and when possible.",
		type: OptionType.Boolean,
	},
	"only-changed": {
		default: false,
		description:
			"When set to true, only the files that have been changed compared to your `defaultBranch` configuration will be linted.",
		type: OptionType.Boolean,
	},
	reporter: {
		choices: [
			ReporterType.GitHub,
			ReporterType.GitLab,
			ReporterType.Json,
			ReporterType.JsonPretty,
			ReporterType.JUnit,
			ReporterType.Summary,
		],
		description: "Allows to change how diagnostics and summary are reported.",
		type: OptionType.String,
	},
} as const satisfies Schema;

type CommandArguments = ParsedArguments<typeof SCHEMA>;
const commandArguments: CommandArguments = parseArguments(SCHEMA, Bun.argv.slice(2));
const splitFiles = commandArguments.files.split(" ").filter((value) => value.trim() !== "");
const splitFileNames = splitFiles.map((filePath) => basename(filePath));

const FAILED_WITH_EXIT_CODE = chalk.gray("failed with exit code");

function getErrorText(toolName: string, exitCode: number): string {
	return `\t- ${chalk.bold.blue(toolName)} ${FAILED_WITH_EXIT_CODE} ${chalk.bold.yellow(exitCode)}!`;
}

type ExecuteAsyncFunction = (stringBuilder: Array<string>, markErrorsTrue: () => void) => Promise<void>;

async function executeBiomeCiAsync(stringBuilder: Array<string>, markErrorsTrue: () => void): Promise<void> {
	try {
		const command = ["bun", "x", "--bun", "biome", "ci", ...splitFiles];
		if (commandArguments["error-on-warnings"]) command.push("--error-on-warnings");
		if (commandArguments.reporter !== undefined) command.push(`--reporter=${commandArguments.reporter}`);
		if (commandArguments["only-changed"]) command.push("--changed");

		const subprocess = Bun.spawn<"ignore", "inherit">({
			cmd: command,
			stdio: ["ignore", "inherit", "inherit"],
		});
		const exitCode = await subprocess.exited;
		if (exitCode !== 0) {
			stringBuilder.push(getErrorText("Biome CI", exitCode));
			markErrorsTrue();
		} else stringBuilder.push(`\t- ${chalk.green("Biome CI passed successfully!")}`);
	} catch (error: unknown) {
		scriptConsole.error(`Biome CI caught error: ${error}`);
	}
}

function createBiomeExecute(commandName: string): ExecuteAsyncFunction {
	const lowerCommandName = commandName.toLowerCase();
	const name = `Biome ${commandName}`;
	const passed = chalk.green(`${name} passed successfully!`);

	return async function executeAsync(stringBuilder: Array<string>, markErrorsTrue: () => void): Promise<void> {
		try {
			const command = ["bun", "x", "--bun", "biome", lowerCommandName, "--fix", ...splitFiles];
			if (commandArguments["error-on-warnings"]) command.push("--error-on-warnings");
			if (commandArguments.reporter !== undefined) command.push(`--reporter=${commandArguments.reporter}`);
			if (commandArguments["only-changed"]) command.push("--changed");

			const subprocess = Bun.spawn<"ignore", "inherit">({
				cmd: command,
				stdio: ["ignore", "inherit", "inherit"],
			});
			const exitCode = await subprocess.exited;
			if (exitCode !== 0) {
				stringBuilder.push(getErrorText(name, exitCode));
				markErrorsTrue();
			} else stringBuilder.push(`\t- ${passed}`);
		} catch (error: unknown) {
			scriptConsole.error(`${name} caught error: ${error}`);
		}
	};
}

const executeBiomeFormatAsync = createBiomeExecute("Format");
const executeBiomeLintAsync = createBiomeExecute("Lint");
async function executeBiomeRawCiAsync(stringBuilder: Array<string>, markErrorsTrue: () => void): Promise<void> {
	try {
		await executeBiomeFormatAsync(stringBuilder, markErrorsTrue);
		await executeBiomeLintAsync(stringBuilder, markErrorsTrue);
	} catch (error: unknown) {
		scriptConsole.error(`Biome Raw CI caught error: ${error}`);
	}
}

async function executeBiomeAsync(stringBuilder: Array<string>, markErrorsTrue: () => void): Promise<void> {
	const callback = commandArguments.fix ? executeBiomeRawCiAsync : executeBiomeCiAsync;
	await callback(stringBuilder, markErrorsTrue);
}

function getCommandForTsc(): Array<string> {
	if (process.platform === "win32")
		return commandArguments.files === DEFAULT_FILES
			? ["bun", "x", "tsc", "--noEmit", "-p", "tsconfig.json"]
			: ["powershell.exe", "-ExecutionPolicy", "Bypass", "-File", "./scripts/tsc.ps1", ...splitFileNames];

	return commandArguments.files === DEFAULT_FILES
		? ["bun", "x", "tsc", "--noEmit", "-p", "tsconfig.json"]
		: ["./scripts/tsc.sh", ...splitFileNames];
}

async function executeTscAsync(stringBuilder: Array<string>, markErrorsTrue: () => void): Promise<void> {
	try {
		const subprocess = Bun.spawn<"ignore", "inherit">({
			cmd: getCommandForTsc(),
			stdio: ["ignore", "inherit", "inherit"],
		});
		const exitCode = await subprocess.exited;

		if (exitCode !== 0) {
			stringBuilder.push(getErrorText("TSC", exitCode));
			markErrorsTrue();
		} else stringBuilder.push(`\t- ${chalk.green("TSC passed successfully!")}`);
	} catch (error: unknown) {
		scriptConsole.error(`TSC caught error: ${error}`);
	}
}

async function executeEsLintAsync(stringBuilder: Array<string>, markErrorsTrue: () => void): Promise<void> {
	try {
		const command = ["bun", "x", "eslint", "--max-warnings=0", ...splitFiles];
		if (commandArguments.fix) command.push("--fix");

		const subprocess = Bun.spawn<"ignore", "inherit">({
			cmd: command,
			stdio: ["ignore", "inherit", "inherit"],
		});
		const exitCode = await subprocess.exited;
		if (exitCode !== 0) {
			stringBuilder.push(getErrorText("ESLint", exitCode));
			markErrorsTrue();
		} else stringBuilder.push(`\t- ${chalk.green("ESLint passed successfully!")}`);
	} catch (error: unknown) {
		scriptConsole.error(`ESLint caught error: ${error}`);
	}
}

async function mainAsync(): Promise<void> {
	const stringBuilder = new Array<string>();
	let anyErrors = false;
	function markErrorsTrue(): void {
		anyErrors = true;
	}

	await executeBiomeAsync(stringBuilder, markErrorsTrue);
	await executeTscAsync(stringBuilder, markErrorsTrue);
	await executeEsLintAsync(stringBuilder, markErrorsTrue);

	if (anyErrors) {
		scriptConsole.error(chalk.bold("Failed to run lint-all:"));
		scriptConsole.info(stringBuilder.join("\n"));
		process.exit(1);
	} else scriptConsole.success("Linting completed successfully!");
}

mainAsync().catch((error: unknown): never => {
	scriptConsole.error(`Failed to run lint-all script: ${error}`);
	process.exit(1);
});
