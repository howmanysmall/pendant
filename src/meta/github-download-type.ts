/**
 * Enumerates the supported methods for downloading files from GitHub.
 *
 * This enum is used to specify which underlying implementation should be used
 * when fetching files from GitHub repositories, allowing for flexibility and
 * future extensibility.
 *
 * - `Fetch` uses the native fetch API for direct HTTP requests.
 * - `OctokitCore` uses the Octokit Core library for authenticated or advanced
 *   requests.
 *
 * @see https://docs.github.com/en/rest
 */
export const enum GitHubDownloadType {
	/**
	 * Use the native fetch API to download files from GitHub.
	 *
	 * This method is suitable for public repositories and simple HTTP requests.
	 */
	Fetch = "fetch",

	/**
	 * Use the Octokit Core library to download files from GitHub.
	 *
	 * This method supports authenticated requests and advanced GitHub API
	 * features.
	 */
	OctokitCore = "octokit-core",
}

export default GitHubDownloadType;
