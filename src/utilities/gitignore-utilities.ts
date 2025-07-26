import { createNamespaceLogger } from "logging/logger-utilities";

const logger = createNamespaceLogger("gitignore-utilities");

/**
 * Parses a .gitignore file and extracts valid glob patterns.
 *
 * @param gitignorePath - The path to the .gitignore file.
 * @returns Array of glob patterns suitable for luau-lsp ignore flags.
 */
export async function parseGitignoreAsync(gitignorePath = ".gitignore"): Promise<ReadonlyArray<string>> {
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
