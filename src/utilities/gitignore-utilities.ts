import { createNamespaceLogger } from "logging/logger-utilities";

import { trim } from "./string-utilities";

const logger = createNamespaceLogger("gitignore-utilities");

const DEFAULT_GITIGNORE_PATH = ".gitignore";

/** Simple ignore filter implementation to replace the ignore package. */
export interface IgnoreFilter {
	/**
	 * Adds patterns to the ignore filter.
	 *
	 * @param patterns - The patterns to add.
	 */
	add(patterns: ReadonlyArray<string> | string): void;

	/**
	 * Tests if a path should be ignored.
	 *
	 * @param path - The path to test.
	 * @returns True if the path should be ignored.
	 */
	ignores(path: string): boolean;
}

function isNotCommented(line: string): boolean {
	return Boolean(line) && !line.startsWith("#");
}

const RELATIVE_PATH_REGEX = /^\.\.\/+/g;
const LEADING_SLASH_REGEX = /^\/+/;
const WILDCARD_GLOB_REGEX = /\*\*/g;
const WILDCARD_REGEX = /\*/g;
const QUERY_PARAM_REGEX = /\?/g;

/**
 * Creates a simple ignore filter that matches glob patterns.
 *
 * @returns A new ignore filter instance.
 */
export function createSimpleIgnoreFilter(): IgnoreFilter {
	const patterns = new Array<string>();
	let length = 0;

	return {
		add(input: ReadonlyArray<string> | string): void {
			if (typeof input === "string") {
				const lines = input.split("\n").map(trim).filter(isNotCommented);
				for (const line of lines) patterns[length++] = line;
			} else for (const line of input) patterns[length++] = line;
		},

		ignores(path: string): boolean {
			let normalizedPath = path.replace(RELATIVE_PATH_REGEX, "");

			normalizedPath = normalizedPath.replace(LEADING_SLASH_REGEX, "");

			for (const pattern of patterns) {
				const normalizedPattern = pattern.replace(LEADING_SLASH_REGEX, "");

				if (normalizedPattern.endsWith("/")) {
					const directoryPattern = normalizedPattern.slice(0, -1);
					if (normalizedPath === directoryPattern || normalizedPath.startsWith(`${directoryPattern}/`))
						return true;
				} else if (normalizedPattern.includes("*")) {
					const regexPattern = normalizedPattern
						.replace(WILDCARD_GLOB_REGEX, ".*")
						.replace(WILDCARD_REGEX, "[^/]*")
						.replace(QUERY_PARAM_REGEX, "[^/]");
					const regex = new RegExp(`^${regexPattern}$`);
					if (regex.test(normalizedPath)) return true;
				} else if (normalizedPath === normalizedPattern || normalizedPath.startsWith(`${normalizedPattern}/`))
					return true;
			}

			return false;
		},
	};
}

/**
 * Creates an ignore filter from a .gitignore file.
 *
 * @param gitignorePath - The path to the .gitignore file.
 * @returns An ignore filter instance that can be used to filter paths.
 */
export async function createIgnoreFilterAsync(gitignorePath = DEFAULT_GITIGNORE_PATH): Promise<IgnoreFilter> {
	const filter = createSimpleIgnoreFilter();

	try {
		const file = Bun.file(gitignorePath);
		const exists = await file.exists();
		if (!exists) {
			logger.debug(`No .gitignore file found at ${gitignorePath}`);
			return filter;
		}

		const content = await file.text();
		filter.add(content);

		logger.debug(`Loaded gitignore patterns from ${gitignorePath}`);
		return filter;
	} catch (error) {
		logger.warn(`Failed to read .gitignore file: ${error}`);
		return filter;
	}
}

/**
 * Parses a .gitignore file and extracts valid glob patterns.
 *
 * @param gitignorePath - The path to the .gitignore file.
 * @returns Array of glob patterns suitable for luau-lsp ignore flags.
 */
export async function parseGitignoreAsync(gitignorePath = DEFAULT_GITIGNORE_PATH): Promise<ReadonlyArray<string>> {
	try {
		const file = Bun.file(gitignorePath);
		const exists = await file.exists();
		if (!exists) {
			logger.debug(`No .gitignore file found at ${gitignorePath}`);
			return [];
		}

		const content = await file.text();
		const lines = content.split("\n");
		const patterns = new Array<string>();
		let length = 0;

		for (const line of lines) {
			const trimmed = line.trim();

			// Skip empty lines and comments
			if (!trimmed || trimmed.startsWith("#")) continue;

			// Skip negation patterns (not supported by luau-lsp)
			if (trimmed.startsWith("!")) {
				logger.debug(`Skipping negation pattern: ${trimmed}`);
				continue;
			}

			// Convert gitignore patterns to glob patterns
			let pattern = trimmed;

			// Remove leading slash (absolute paths in gitignore)
			if (pattern.startsWith("/")) pattern = pattern.slice(1);

			// Add ** for directory patterns if needed
			if (pattern.endsWith("/")) pattern = `${pattern}**`;

			patterns[length++] = pattern;
		}

		if (length > 0) logger.debug(`Parsed ${length} patterns from ${gitignorePath}`);

		return patterns;
	} catch (error) {
		logger.error(`Failed to parse .gitignore: ${error}`);
		return [];
	}
}

/**
 * Gets default ignore patterns by combining gitignore patterns with optional
 * custom patterns.
 *
 * @param gitignorePath - The path to the .gitignore file.
 * @param customPatterns - Additional custom patterns to include.
 * @returns Array of combined ignore patterns.
 */
export async function getDefaultIgnorePatternsAsync(
	gitignorePath = ".gitignore",
	customPatterns: ReadonlyArray<string> = [],
): Promise<ReadonlyArray<string>> {
	const gitignorePatterns = await parseGitignoreAsync(gitignorePath);
	return [...gitignorePatterns, ...customPatterns];
}
