#!/usr/bin/env bun

/**
 * Generates a well-structured changelog prompt for advanced language models.
 *
 * This script collects git commit history, pull requests, issues, and
 * optionally file diffs to create a comprehensive prompt that can be fed to
 * LLMs like Claude, Gemini, GPT-4, or O3/O4 variants for automatic changelog
 * generation.
 */

import { Octokit } from "@octokit/rest";

import scriptConsole from "./utilities/script-console";

const REPO_OWNER = "howmanysmall";
const REPO_NAME = "pendant";

/** Environment variable configuration for LLM providers. */
interface ProviderConfiguration {
	/** An Anthropic/Claude API key. */
	readonly anthropic?: string;

	/** A DeepSeek API key. */
	readonly deepseek?: string;

	/** A Google Gemini API key. */
	readonly google?: string;

	/** An OpenAI API key. */
	readonly openai?: string;

	/** An OpenRouter API key for unified multi-model access. */
	readonly openRouter?: string;

	/** An xAI/Grok API key. */
	readonly xai?: string;
}

interface CommitInfo {
	readonly author: string;
	readonly date: string;
	readonly hash: string;
	readonly subject: string;
}

interface PullRequestInfo {
	readonly body?: string;
	readonly mergedAt?: string;
	readonly number: number;
	readonly state: string;
	readonly title: string;
}

interface IssueInfo {
	readonly closedAt?: string;
	readonly labels: ReadonlyArray<string>;
	readonly number: number;
	readonly state: string;
	readonly title: string;
}

interface ReleaseInfo {
	readonly body?: string;
	readonly name: string;
	readonly publishedAt: string;
	readonly tagName: string;
}

/**
 * Executes a shell command and returns the output.
 *
 * @param command - The shell command to execute.
 * @returns The command output as a string.
 */
function executeCommandSync(command: string): string {
	try {
		return Bun.spawnSync(["zsh", "-c", command]).stdout.toString().trim();
	} catch (error) {
		scriptConsole.error(
			`Failed to execute command: ${command} - ${error instanceof Error ? error.message : String(error)}`,
		);
		return "";
	}
}

/**
 * Loads environment variables for LLM provider configuration.
 *
 * @returns Configuration object with available API keys.
 */
function loadProviderConfiguration(): ProviderConfiguration {
	return {
		anthropic: Bun.env.ANTHROPIC_API_KEY,
		deepseek: Bun.env.DEEPSEEK_API_KEY,
		google: Bun.env.GOOGLE_GEMINI_API_KEY,
		openai: Bun.env.OPENAI_API_KEY,
		openRouter: Bun.env.OPEN_ROUTER_API_KEY,
		xai: Bun.env.XAI_API_KEY,
	};
}

/**
 * Gets the latest release information from GitHub.
 *
 * @param octokit - Configured Octokit instance.
 * @returns Promise resolving to release information.
 */
async function getLatestReleaseAsync(octokit: Octokit): Promise<ReleaseInfo> {
	const response = await octokit.repos.getLatestRelease({
		owner: REPO_OWNER,
		repo: REPO_NAME,
	});

	return {
		name: response.data.name ?? response.data.tag_name,
		body: response.data.body ?? undefined,
		publishedAt: response.data.published_at ?? "",
		tagName: response.data.tag_name,
	};
}

/**
 * Gets commit history since the last release.
 *
 * @param lastReleaseTag - Tag name of the last release.
 * @returns Array of commit information.
 */
function getCommitHistorySinceRelease(lastReleaseTag: string): ReadonlyArray<CommitInfo> {
	const commitOutput = executeCommandSync(`git log ${lastReleaseTag}..HEAD --pretty=format:"%h|%s|%an|%ar"`);
	if (!commitOutput) return [];

	return commitOutput
		.split("\n")
		.filter((line) => line.trim().length > 0)
		.map((line) => {
			const [hash, subject, author, date] = line.split("|");
			return {
				author: author ?? "",
				date: date ?? "",
				hash: hash ?? "",
				subject: subject ?? "",
			};
		});
}

/**
 * Gets recent pull requests from GitHub.
 *
 * @param octokit - Configured Octokit instance.
 * @param lastReleaseDate - Date of the last release for filtering.
 * @returns Promise resolving to array of pull request information.
 */
async function getRecentPullRequestsAsync(
	octokit: Octokit,
	lastReleaseDate: string,
): Promise<ReadonlyArray<PullRequestInfo>> {
	const response = await octokit.pulls.list({
		direction: "desc",
		owner: REPO_OWNER,
		// eslint-disable-next-line camelcase -- sybau
		per_page: 20,
		repo: REPO_NAME,
		sort: "updated",
		state: "closed",
	});

	const releaseDate = new Date(lastReleaseDate);

	return response.data
		.filter((pr) => {
			if (!pr.merged_at) return false;
			return new Date(pr.merged_at) > releaseDate;
		})
		.map((pr) => ({
			body: pr.body ?? undefined,
			mergedAt: pr.merged_at ?? undefined,
			number: pr.number,
			state: pr.state,
			title: pr.title,
		}));
}

/**
 * Gets recent issues from GitHub.
 *
 * @param octokit - Configured Octokit instance.
 * @param lastReleaseDate - Date of the last release for filtering.
 * @returns Promise resolving to array of issue information.
 */
async function getRecentIssuesAsync(octokit: Octokit, lastReleaseDate: string): Promise<ReadonlyArray<IssueInfo>> {
	const response = await octokit.issues.listForRepo({
		direction: "desc",
		owner: REPO_OWNER,
		// eslint-disable-next-line camelcase -- sybau
		per_page: 20,
		repo: REPO_NAME,
		since: lastReleaseDate,
		sort: "updated",
		state: "closed",
	});

	return response.data
		.filter((issue) => !issue.pull_request) // Exclude PRs
		.map((issue) => ({
			closedAt: issue.closed_at ?? undefined,
			labels: issue.labels.map((label) => (typeof label === "string" ? label : (label.name ?? ""))),
			number: issue.number,
			state: issue.state,
			title: issue.title,
		}));
}

/**
 * Gets diff information if current-release directory exists.
 *
 * @returns Diff information or undefined if not available.
 */
async function getCurrentReleaseDiffAsync(): Promise<string | undefined> {
	try {
		const currentReleaseExists = await Bun.file("current-release").exists();
		if (!currentReleaseExists) {
			return undefined;
		}

		// Get a summary of changes in current-release directory
		const diffOutput = executeCommandSync("fd -e ts -e js -e json current-release | head -10 | xargs wc -l");

		if (diffOutput) {
			return `File count and line summary from current-release:\n${diffOutput}`;
		}

		return undefined;
	} catch {
		return undefined;
	}
}

/**
 * Generates a comprehensive changelog prompt for LLMs.
 *
 * @param releaseInfo - Information about the latest release.
 * @param commits - Array of commit information.
 * @param pullRequests - Array of pull request information.
 * @param issues - Array of issue information.
 * @param diffInfo - Optional diff information.
 * @returns Formatted changelog prompt.
 */
// eslint-disable-next-line better-max-params/better-max-params, max-lines-per-function -- sybau
function generateChangelogPrompt(
	releaseInfo: ReleaseInfo,
	commits: ReadonlyArray<CommitInfo>,
	pullRequests: ReadonlyArray<PullRequestInfo>,
	issues: ReadonlyArray<IssueInfo>,
	diffInfo?: string,
): string {
	const sections = [
		"# Changelog Generation Request",
		"",
		"Please generate a comprehensive changelog for the next release of **pendant**, a Luau LSP wrapper tool.",
		"",
		"## Project Context",
		"",
		'**pendant** is a TypeScript/Bun-based CLI tool that serves as a "visual" Luau LSP wrapper, designed to improve linting capabilities for Luau code. The project uses modern JavaScript runtime (Bun) and follows strict TypeScript coding standards.',
		"",
		`## Previous Release: ${releaseInfo.name} (${releaseInfo.tagName})`,
		`**Published:** ${new Date(releaseInfo.publishedAt).toLocaleDateString()}`,
		"",
		...(releaseInfo.body ? ["**Previous Release Notes:**", "```", releaseInfo.body, "```", ""] : []),
		"## Changes Since Last Release",
		"",
		"### Commits",
		"",
		...(commits.length > 0
			? [
					"```",
					...commits.map((commit) => `${commit.hash} - ${commit.subject} (${commit.author}, ${commit.date})`),
					"```",
					"",
				]
			: ["No commits found since last release.", ""]),
		"### Pull Requests",
		"",
		...(pullRequests.length > 0
			? [
					...pullRequests.map(
						(pr) =>
							// eslint-disable-next-line sonar/no-nested-template-literals -- sybau
							`- **#${pr.number}**: ${pr.title}${pr.mergedAt ? ` (merged ${new Date(pr.mergedAt).toLocaleDateString()})` : ""}`,
					),
					"",
				]
			: ["No pull requests found since last release.", ""]),
		"### Issues Resolved",
		"",
		...(issues.length > 0
			? [
					...issues.map(
						(issue) =>
							// eslint-disable-next-line sonar/no-nested-template-literals -- sybau
							`- **#${issue.number}**: ${issue.title}${issue.labels.length > 0 ? ` [${issue.labels.join(", ")}]` : ""}`,
					),
					"",
				]
			: ["No issues found since last release.", ""]),
		...(diffInfo ? ["### File Changes Summary", "", "```", diffInfo, "```", ""] : []),
		"## Changelog Requirements",
		"",
		"Please create a changelog entry that:",
		"",
		"1. **Follows semantic versioning principles**",
		"2. **Categorizes changes** into:",
		"   - 🚀 **New Features**",
		"   - 🐛 **Bug Fixes**",
		"   - 💥 **Breaking Changes**",
		"   - 📚 **Documentation**",
		"   - 🔧 **Internal/Development**",
		"3. **Uses clear, user-focused language**",
		"4. **References relevant issue/PR numbers**",
		"5. **Follows Keep a Changelog format**",
		"",
		"## Output Format",
		"",
		"Please provide the changelog entry in standard Markdown format, ready to be added to a CHANGELOG.md file or used in GitHub release notes.",
	];

	return sections.join("\n");
}

/**
 * Attempts to send the prompt to an available LLM provider.
 *
 * @param _prompt - The generated changelog prompt.
 * @param config - LLM provider configuration.
 * @returns Promise resolving to generated changelog or undefined if no provider
 *   available.
 */
async function generateChangelogWithLLMAsync(
	_prompt: string,
	config: ProviderConfiguration,
): Promise<string | undefined> {
	// This is a placeholder for LLM integration
	// Implementation would depend on specific provider APIs
	scriptConsole.info("LLM integration not implemented yet. Available providers:");

	if (config.openRouter) scriptConsole.info("- OpenRouter API key found");
	if (config.anthropic) scriptConsole.info("- Anthropic API key found");
	if (config.google) scriptConsole.info("- Google API key found");
	if (config.openai) scriptConsole.info("- OpenAI API key found");
	if (config.deepseek) scriptConsole.info("- DeepSeek API key found");
	if (config.xai) scriptConsole.info("- xAI API key found");

	return undefined;
}

/** Main function to create the changelog. */
// eslint-disable-next-line max-lines-per-function -- sybau
async function createChangelogAsync(): Promise<void> {
	try {
		// Load LLM provider configuration
		const llmConfig = loadProviderConfiguration();

		// Check for GitHub token
		if (!Bun.env.GITHUB_TOKEN) {
			scriptConsole.error("GITHUB_TOKEN environment variable is required");
			process.exit(1);
		}

		// Initialize Octokit
		const octokit = new Octokit({
			auth: Bun.env.GITHUB_TOKEN,
		});

		scriptConsole.info("Fetching latest release information...");
		const latestRelease = await getLatestReleaseAsync(octokit);

		scriptConsole.info("Getting commit history...");
		const commits = getCommitHistorySinceRelease(latestRelease.tagName);

		scriptConsole.info("Fetching pull requests...");
		const pullRequests = await getRecentPullRequestsAsync(octokit, latestRelease.publishedAt);

		scriptConsole.info("Fetching issues...");
		const issues = await getRecentIssuesAsync(octokit, latestRelease.publishedAt);

		scriptConsole.info("Checking for current-release diff...");
		const diffInfo = await getCurrentReleaseDiffAsync();

		scriptConsole.info("Generating changelog prompt...");
		const prompt = generateChangelogPrompt(latestRelease, commits, pullRequests, issues, diffInfo);

		// Write prompt to file
		await Bun.write("changelog-prompt.md", prompt);
		scriptConsole.info("✅ Changelog prompt saved to changelog-prompt.md");

		// Attempt LLM generation if API keys are available
		const generatedChangelog = await generateChangelogWithLLMAsync(prompt, llmConfig);

		if (generatedChangelog) {
			await Bun.write("CHANGELOG-generated.md", generatedChangelog);
			scriptConsole.info("✅ Generated changelog saved to CHANGELOG-generated.md");
		} else {
			scriptConsole.info(
				"📝 No LLM API keys found. Please use the prompt in changelog-prompt.md with your preferred LLM.",
			);
		}
	} catch (error) {
		scriptConsole.error(`❌ Failed to create changelog: ${error instanceof Error ? error.message : String(error)}`);
		process.exit(1);
	}
}

// Run the script if called directly
await createChangelogAsync();
