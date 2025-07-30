import { Octokit } from "@octokit/core";

import { createNamespaceLogger } from "logging/logger-utilities";
import GitHubDownloadType from "meta/github-download-type";
import { resolve } from "node:path";
import { z } from "zod/mini";
import { fromError } from "zod-validation-error";

const logger = createNamespaceLogger("download-global-types-async");

let coreCached: Octokit | undefined;
function getOctokitCore(): Octokit {
	if (coreCached) return coreCached;

	const octokit = new Octokit({ auth: Bun.env.GITHUB_TOKEN });
	coreCached = octokit;
	return octokit;
}

async function fetchGlobalTypesAsync(targetPath: string, verbose: boolean): Promise<void> {
	const url = "https://raw.githubusercontent.com/JohnnyMorganz/luau-lsp/main/scripts/globalTypes.d.luau";

	try {
		logger.info("Downloading globalTypes.d.luau using fetch...");
		const response = await Bun.fetch(url, { verbose });

		if (!response.ok) throw new Error(`Failed to download: ${response.status} ${response.statusText}`);

		const content = await response.text();
		await Bun.write(targetPath, content);
		logger.info("Successfully downloaded globalTypes.d.luau");
	} catch (error) {
		logger.error(`Failed to download globalTypes.d.luau: ${error}`);
		throw error;
	}
}

const isGoodResponseData = z.object({
	content: z.string(),
	encoding: z.literal("base64"),
});

async function octokitGlobalTypesAsync(targetPath: string, verbose: boolean): Promise<void> {
	try {
		logger.info("Downloading globalTypes.d.luau using Octokit...");

		const response = await getOctokitCore().request("GET /repos/{owner}/{repo}/contents/{path}", {
			owner: "JohnnyMorganz",
			path: "scripts/globalTypes.d.luau",
			repo: "luau-lsp",
		});

		const result = await isGoodResponseData.safeParseAsync(response.data);
		if (!result.success) throw fromError(result.error);

		const content = Buffer.from(result.data.content, "base64").toString("utf-8");
		const fullPath = resolve(process.cwd(), targetPath);

		await Bun.write(fullPath, content);
		if (verbose) logger.info(`Successfully downloaded globalTypes.d.luau to ${fullPath}`);
	} catch (error: unknown) {
		logger.error(`Failed to download globalTypes.d.luau using Octokit: ${error}`);
		throw error;
	}
}

/**
 * Downloads globalTypes.d.luau from the official repository.
 *
 * @param githubDownloadType - The method to use for downloading.
 * @param targetPath - Path to save the downloaded file (default:
 *   "globalTypes.d.luau").
 * @param verbose - Whether to have verbose logging for fetch.
 * @returns Promise resolving when download is complete.
 * @throws Error if download fails.
 */
export default async function downloadGlobalTypesAsync(
	githubDownloadType: GitHubDownloadType = GitHubDownloadType.Fetch,
	targetPath = "globalTypes.d.luau",
	verbose = false,
): Promise<void> {
	switch (githubDownloadType) {
		case GitHubDownloadType.Fetch: {
			await fetchGlobalTypesAsync(targetPath, verbose);
			break;
		}

		case GitHubDownloadType.OctokitCore: {
			await octokitGlobalTypesAsync(targetPath, verbose);
			break;
		}

		default: {
			throw new Error(`Unknown download type: ${githubDownloadType}`);
		}
	}
}
