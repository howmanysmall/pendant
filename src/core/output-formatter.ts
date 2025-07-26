import chalk from "chalk";
import type RuntimeContext from "meta/runtime-context";
import RuntimeContextMeta from "meta/runtime-context-meta";
import prettyMilliseconds from "pretty-ms";
import { pluralize } from "utilities/english-utilities";

/** Represents a single analysis issue found by luau-lsp. */
export interface AnalysisIssue {
	/** The column number where the issue was found. */
	readonly column: number;
	/** The path to the file where the issue was found. */
	readonly filePath: string;
	/** The line number where the issue was found. */
	readonly line: number;
	/** The detailed message describing the issue. */
	readonly message: string;
	/** The severity level of the issue. */
	readonly severity: "error" | "info" | "warning";
}

/** Represents the analysis result for a specific runtime context. */
export interface ContextAnalysisResult {
	/** The runtime context to which these results belong. */
	readonly context: RuntimeContext;
	/** A list of analysis issues found within this context. */
	readonly issues: ReadonlyArray<AnalysisIssue>;
	/** The raw output string from the luau-lsp process for this context. */
	readonly rawOutput: string;
}

/**
 * Represents the formatted analysis results, ready for display or further
 * processing.
 */
export interface FormattedAnalysisResult {
	/** A map of runtime contexts to the number of issues found in each. */
	readonly issuesByContext: ReadonlyMap<RuntimeContext, number>;
	/**
	 * The content formatted for a problems file, typically used by external
	 * tools.
	 */
	readonly problemsFileContent: string;
	/** The string builder output for console display. */
	readonly stringBuilder: ReadonlyArray<string>;
	/** The total number of issues found across all contexts. */
	readonly totalIssues: number;
}

const BOLD = chalk.bold;
const GRAY = chalk.gray;
const CYAN_BOLD = BOLD.cyan;

/**
 * Returns a formatted string of the current time.
 *
 * @returns A gray-colored string representing the current time.
 */
function getTime(): string {
	return GRAY(new Date().toLocaleString("en-US", { timeStyle: "medium" }));
}

/**
 * Formats a number with bold cyan color.
 *
 * @param number - The number to format.
 * @returns A bold cyan-colored string of the number.
 */
function formatNumber(number: number): string {
	return CYAN_BOLD(number);
}

const FILE_PATH_REGEX = /^(.+?)\((\d+),(\d+)\):\s+(.+)$/;
const DOUBLE_SLASH_REGEX = /\/+/g;
const LEADING_SLASH_REGEX = /^\/+/;

/**
 * Parses the raw output from luau-lsp to extract individual analysis issues.
 * Expected format for each issue line: "src/Util/Constants.luau(14,23):
 * TypeError: Value of type 'Instance?' could be nil".
 *
 * Handles multiline errors where additional context appears on subsequent lines
 * that don't match the main pattern (e.g., "caused by:", explanatory text).
 *
 * @param output - The raw string output from the luau-lsp analyze command.
 * @returns An array of parsed `AnalysisIssue` objects.
 */
export function parseLuauLspOutput(output: string): ReadonlyArray<AnalysisIssue> {
	const issues = new Array<AnalysisIssue>();
	let length = 0;
	const lines = output.split("\n");

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index]?.trim();
		if (line === undefined || line.length === 0) continue;

		const match = line.match(FILE_PATH_REGEX);
		if (match) {
			const [, rawPath, lineString, columnString, message] = match;
			if (!rawPath || !lineString || !columnString || !message) continue;

			const filePath = rawPath.replace(DOUBLE_SLASH_REGEX, "/").replace(LEADING_SLASH_REGEX, "");

			let fullMessage = message;
			let nextIndex = index + 1;

			while (nextIndex < lines.length) {
				const nextLine = lines[nextIndex]?.trim();
				if (nextLine === undefined || nextLine.length === 0) {
					nextIndex += 1;
					continue;
				}

				if (FILE_PATH_REGEX.test(nextLine)) break;

				fullMessage += `\n${nextLine}`;
				nextIndex += 1;
			}

			issues[length++] = {
				column: Number.parseInt(columnString, 10),
				filePath,
				line: Number.parseInt(lineString, 10),
				message: fullMessage,
				severity: message.toLowerCase().includes("error") ? "error" : "warning",
			};

			// Skip the lines we've already processed
			index = nextIndex - 1;
		}
	}

	return issues;
}

/**
 * Formats a collection of analysis results into a human-readable string and
 * extracts relevant data.
 *
 * @param results - An array of `ContextAnalysisResult` objects, each containing
 *   issues for a specific context.
 * @param isWatchMode - A boolean indicating whether the analysis is running in
 *   watch mode.
 * @returns A `FormattedAnalysisResult` object containing the formatted output,
 *   issue counts, and problems file content.
 */
export function formatAnalysisResults(
	results: ReadonlyArray<ContextAnalysisResult>,
	isWatchMode = false,
): FormattedAnalysisResult {
	const issuesByContext = new Map<RuntimeContext, number>();
	const allIssues = new Array<AnalysisIssue>();

	// Collect all issues and count by context
	for (const result of results) {
		issuesByContext.set(result.context, result.issues.length);
		allIssues.push(...result.issues);
	}

	const totalIssues = allIssues.length;
	const stringBuilder = [
		// Main status line
		isWatchMode
			? `[${getTime()}] Found ${formatNumber(totalIssues)} ${pluralize(totalIssues, "issue")}. Watching for file changes.`
			: `[${getTime()}] Analysis complete. Found ${formatNumber(totalIssues)} ${pluralize(totalIssues, "issue")}.`,
	];
	let length = 1;

	// Context breakdown
	for (const [context, count] of issuesByContext)
		if (count > 0) {
			const { name, chalkInstance = BOLD, emoji } = RuntimeContextMeta[context];
			stringBuilder[length++] =
				`\t${emoji} ${chalkInstance(name)}: ${formatNumber(count)} ${pluralize(count, "issue")}`;
		}

	// Generate problems file content (raw issues for external tools)
	const problemsFileContent = allIssues
		.map((issue) => `${issue.filePath} [${issue.line}:${issue.column}] ${issue.message}`)
		.join("\n");

	return { issuesByContext, problemsFileContent, stringBuilder, totalIssues };
}

const MATCH_NUMBER_REGEX = /\d+\.?\d*/g;
function colorNumber(match: string): string {
	return CYAN_BOLD(match);
}
function colorifyNumbersInString(value: string): string {
	return value.replace(MATCH_NUMBER_REGEX, colorNumber);
}

/**
 * Formats a duration in milliseconds into a human-readable string (e.g.,
 * "123ms" or "1.23s").
 *
 * @param durationMs - The duration in milliseconds.
 * @returns A formatted string representing the duration.
 */
export function formatPerformanceInfo(durationMs: number): string {
	return colorifyNumbersInString(
		prettyMilliseconds(durationMs, {
			formatSubMilliseconds: true,
			unitCount: 3,
		}),
	);
}
