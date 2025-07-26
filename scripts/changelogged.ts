#!/usr/bin/env bun
/* eslint-disable max-lines -- sybau */
/* eslint-disable max-lines-per-function -- sybau */

import { $ } from "bun";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** Configuration options for the changelog generator. */
interface ChangelogConfig {
	/** The tag of the previous release to compare against. */
	readonly fromTag?: string;
	/** Whether to include a diff from current-release directory. */
	readonly includeDiff: boolean;
	/** Maximum number of commits to include in the analysis. */
	readonly maxCommits: number;
	/** Maximum number of issues to include. */
	readonly maxIssues: number;
	/** Maximum number of pull requests to include. */
	readonly maxPullRequests: number;
	/** The repository owner/organization name. */
	readonly owner: string;
	/** The repository name. */
	readonly repository: string;
	/** The tag or commit of the current release. */
	readonly toTag: string;
}

/** LLM provider configuration for API calls. */
interface LlmProvider {
	/** Function to call the LLM API with a prompt. */
	readonly callApi: (prompt: string) => Promise<string>;
	/** The provider name for logging. */
	readonly name: string;
}

/** Represents a git commit with relevant metadata. */
interface GitCommit {
	/** The commit author name. */
	readonly author: string;
	/** The commit message body. */
	readonly body: string;
	/** The commit date. */
	readonly date: string;
	/** Files changed in this commit. */
	readonly files: ReadonlyArray<string>;
	/** The commit hash. */
	readonly hash: string;
	/** The commit message subject. */
	readonly subject: string;
}

/** Represents a GitHub pull request. */
interface PullRequest {
	/** The pull request author. */
	readonly author: string;
	/** The pull request body/description. */
	readonly body: string;
	/** Labels assigned to the pull request. */
	readonly labels: ReadonlyArray<string>;
	/** The merge commit SHA if merged. */
	readonly mergeCommitSha?: string;
	/** The pull request number. */
	readonly number: number;
	/** The pull request title. */
	readonly title: string;
}

/** Represents a GitHub issue. */
interface GitHubIssue {
	/** The issue author. */
	readonly author: string;
	/** The issue body/description. */
	readonly body: string;
	/** Whether the issue is closed. */
	readonly closed: boolean;
	/** Labels assigned to the issue. */
	readonly labels: ReadonlyArray<string>;
	/** The issue number. */
	readonly number: number;
	/** The issue title. */
	readonly title: string;
}

/** Project structure information. */
interface ProjectStructure {
	/** Main dependencies. */
	readonly dependencies: ReadonlyArray<string>;
	/** The project description. */
	readonly description: string;
	/** Development dependencies. */
	readonly devDependencies: ReadonlyArray<string>;
	/** Key directories in the project. */
	readonly directories: ReadonlyArray<string>;
	/** Key files in the project. */
	readonly files: ReadonlyArray<string>;
	/** The project name. */
	readonly name: string;
	/** The project version. */
	readonly version: string;
}

/** Changelog generation data collected from various sources. */
interface ChangelogData {
	/** Git commits since the last release. */
	readonly commits: ReadonlyArray<GitCommit>;
	/** Configuration used for generation. */
	readonly config: ChangelogConfig;
	/** Issues closed since the last release. */
	readonly issues: ReadonlyArray<GitHubIssue>;
	/** Project structure information. */
	readonly project: ProjectStructure;
	/** Pull requests since the last release. */
	readonly pullRequests: ReadonlyArray<PullRequest>;
	/** Optional diff from current-release directory. */
	readonly releaseDiff?: string;
}

const consoleError = console.error;
const consoleLog = console.log;
const consoleWarn = console.warn;

/**
 * Gets the repository information from git remote.
 *
 * @returns Repository owner and name.
 */
async function getRepositoryInfoAsync(): Promise<{ owner: string; repository: string }> {
	try {
		const remoteUrl = await $`git remote get-url origin`.text();
		// biome-ignore lint/performance/useTopLevelRegex: idc
		const githubPattern = /github\.com[:/]([^/]+)\/([^/\s]+?)(?:\.git)?$/;
		const match = remoteUrl.trim().match(githubPattern);

		if (!match) throw new Error("Could not parse GitHub repository from remote URL");

		return {
			owner: match[1]!,
			repository: match[2]!,
		};
	} catch (error) {
		throw new Error(`Failed to get repository info: ${error}`);
	}
}

/**
 * Gets the latest git tag, or undefined if no tags exist.
 *
 * @returns The latest git tag or undefined.
 */
async function getLatestTagAsync(): Promise<string | undefined> {
	try {
		const tags = await $`git tag --list --sort=-version:refname`.text();
		const tagList = tags.trim().split("\n").filter(Boolean);
		return tagList[0];
	} catch {
		return undefined;
	}
}

/**
 * Gets git commits since the specified tag or from the beginning.
 *
 * @param fromTag - The tag to start from, or undefined to get all commits.
 * @param maxCommits - Maximum number of commits to retrieve.
 * @returns Array of git commits with metadata.
 */
async function getCommitsAsync(fromTag: string | undefined, maxCommits: number): Promise<ReadonlyArray<GitCommit>> {
	const range = fromTag ? `${fromTag}..HEAD` : "HEAD";
	const format = "--pretty=format:%H|%s|%b|%an|%ai";

	try {
		const commitsText = await $`git log ${range} ${format} --max-count=${maxCommits}`.text();
		const commits: Array<GitCommit> = [];

		const commitBlocks = commitsText.split("\n\n").filter(Boolean);

		for (const block of commitBlocks) {
			const lines = block.split("\n");
			const firstLine = lines[0];
			if (!firstLine) continue;

			const [hash, subject, body, author, date] = firstLine.split("|");
			if (!hash || !subject || !author || !date) continue;

			// Get files changed in this commit
			const filesText = await $`git diff-tree --no-commit-id --name-only -r ${hash}`.text();
			const files = filesText.trim().split("\n").filter(Boolean);

			commits.push({
				author,
				body: body ?? "",
				date,
				files,
				hash,
				subject,
			});
		}

		return commits;
	} catch (error) {
		consoleWarn(`Failed to get commits: ${error}`);
		return [];
	}
}

/**
 * Analyzes the project structure from package.json and file system.
 *
 * @returns Project structure information.
 */
async function analyzeProjectStructureAsync(): Promise<ProjectStructure> {
	try {
		const packageJsonContent = await readFile("package.json", "utf-8");
		const packageJson = JSON.parse(packageJsonContent);

		// Get key directories
		const directories = new Array<string>();
		const potentialDirectories = ["src", "lib", "dist", "test", "tests", "docs", "scripts", "benchmarks"];

		for (const directory of potentialDirectories) {
			try {
				const stats = await stat(directory);
				if (stats.isDirectory()) {
					directories.push(directory);
				}
			} catch {
				// Directory doesn't exist, skip
			}
		}

		// Get key files
		const files = new Array<string>();
		const potentialFiles = [
			"README.md",
			"CHANGELOG.md",
			"LICENSE",
			"tsconfig.json",
			"biome.jsonc",
			"eslint.config.ts",
			"bunfig.toml",
		];

		for (const file of potentialFiles) {
			try {
				await stat(file);
				files.push(file);
			} catch {
				// File doesn't exist, skip
			}
		}

		return {
			name: packageJson.name ?? "unknown",
			dependencies: Object.keys(packageJson.dependencies ?? {}),
			description: packageJson.description ?? "",
			devDependencies: Object.keys(packageJson.devDependencies ?? {}),
			directories,
			files,
			version: packageJson.version ?? "0.0.0",
		};
	} catch (error) {
		throw new Error(`Failed to analyze project structure: ${error}`);
	}
}

const CURRENT_RELEASE = "current-release";

/**
 * Gets the diff from current-release directory if it exists.
 *
 * @returns The diff content or undefined if not available.
 */
async function getCurrentReleaseDiffAsync(): Promise<string | undefined> {
	try {
		const releaseStats = await stat(CURRENT_RELEASE);
		if (!releaseStats.isDirectory()) return undefined;

		// Get list of files in current-release
		const files = await readdir(CURRENT_RELEASE, { recursive: true });
		const releaseFiles = files.filter((file) => typeof file === "string");

		if (releaseFiles.length === 0) return undefined;

		// Create a summary of the current release structure
		let diff = "Current Release Directory Structure:\n";
		diff += "======================================\n\n";

		for (const file of releaseFiles.slice(0, 20)) {
			// Limit to first 20 files
			const filePath = join(CURRENT_RELEASE, file);
			try {
				const stats = await stat(filePath);
				if (stats.isFile()) diff += `- ${file} (${stats.size} bytes)\n`;
				else if (stats.isDirectory()) diff += `- ${file}/ (directory)\n`;
			} catch {
				diff += `- ${file} (inaccessible)\n`;
			}
		}

		if (releaseFiles.length > 20) diff += `\n... and ${releaseFiles.length - 20} more files\n`;
		return diff;
	} catch {
		return undefined;
	}
}

/**
 * Generates a comprehensive prompt for LLMs to create a changelog.
 *
 * @param data - The collected changelog data.
 * @returns A structured prompt for LLM consumption.
 */
function generateChangelogPrompt(data: ChangelogData): string {
	const { commits, config, issues, project, pullRequests, releaseDiff } = data;

	let prompt = `# Changelog Generation Request

You are tasked with creating a comprehensive changelog for the **${project.name}** project. This changelog should follow the exact format demonstrated in the Keep a Changelog format example provided below.

## Project Information

**Name:** ${project.name}
**Description:** ${project.description}
**Current Version:** ${project.version}
**Repository:** ${config.owner}/${config.repository}
**Release Range:** ${config.fromTag ?? "initial"} → ${config.toTag}

### Project Structure
- **Main Dependencies:** ${project.dependencies.slice(0, 10).join(", ")}${project.dependencies.length > 10 ? ` (and ${project.dependencies.length - 10} more)` : ""}
- **Key Directories:** ${project.directories.join(", ")}
- **Configuration Files:** ${project.files.join(", ")}

## Required Changelog Format

The changelog MUST follow this exact format from Keep a Changelog:

\`\`\`markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- New features or functionality

### Changed
- Changes in existing functionality

### Deprecated
- Soon-to-be removed features

### Removed
- Now removed features

### Fixed
- Any bug fixes

### Security
- Vulnerability fixes

## [X.Y.Z] - YYYY-MM-DD

### Added
- ...

### Changed
- ...

### Fixed
- ...
\`\`\`

## Git Commits Analysis

Here are the ${commits.length} most recent commits since the last release:

`;

	// Add commit information
	for (const commit of commits) {
		prompt += `**${commit.hash.slice(0, 8)}** - ${commit.subject}\n`;
		prompt += `  Author: ${commit.author}\n`;
		prompt += `  Date: ${commit.date}\n`;
		if (commit.body.trim()) prompt += `  Details: ${commit.body.trim()}\n`;

		const extraFilesSummary = commit.files.length > 5 ? ` (and ${commit.files.length - 5} more)` : "";
		prompt += `  Files: ${commit.files.slice(0, 5).join(", ")}${extraFilesSummary}\n\n`;
	}

	// Add pull request information if available
	if (pullRequests.length > 0) {
		prompt += `## Pull Requests Analysis

The following ${pullRequests.length} pull requests were merged since the last release:

`;

		for (const pr of pullRequests) {
			prompt += `**#${pr.number}** - ${pr.title}\n`;
			prompt += `  Author: ${pr.author}\n`;
			prompt += `  Labels: ${pr.labels.join(", ") ?? "none"}\n`;
			if (pr.body.trim())
				prompt += `  Description: ${pr.body.trim().slice(0, 200)}${pr.body.length > 200 ? "..." : ""}\n`;
			prompt += "\n";
		}
	}

	// Add issues information if available
	if (issues.length > 0) {
		prompt += `## Issues Analysis

The following ${issues.length} issues were addressed since the last release:

`;

		for (const issue of issues) {
			prompt += `**#${issue.number}** - ${issue.title} ${issue.closed ? "(CLOSED)" : "(OPEN)"}\n`;
			prompt += `  Author: ${issue.author}\n`;
			prompt += `  Labels: ${issue.labels.join(", ") || "none"}\n`;
			if (issue.body.trim())
				prompt += `  Description: ${issue.body.trim().slice(0, 200)}${issue.body.length > 200 ? "..." : ""}\n`;
			prompt += "\n";
		}
	}

	// Add release diff if available
	if (releaseDiff) {
		prompt += `## Current Release Information

${releaseDiff}

`;
	}

	// Add instructions
	prompt += `## Instructions

Based on the above information, please create a changelog entry that:

1. **Follows the exact format** shown in the Keep a Changelog example
2. **Categorizes changes appropriately** into Added, Changed, Deprecated, Removed, Fixed, and Security sections
3. **Uses clear, user-friendly language** that explains the impact of changes
4. **Groups related changes** logically within each section
5. **Includes relevant issue/PR references** where appropriate (e.g., "(#123)")
6. **Focuses on user-facing changes** rather than internal implementation details
7. **Uses the correct version number** (${project.version}) and today's date
8. **Maintains consistency** with the project's domain (this is a Luau linting tool)

## Additional Context

This project appears to be a Luau linting and analysis tool that wraps Luau-LSP. Consider the following when categorizing changes:
- **Added**: New linting rules, analysis features, CLI commands, or supported file types
- **Changed**: Modified behavior in existing linting, improved performance, or updated dependencies
- **Fixed**: Bug fixes in linting accuracy, CLI issues, or analysis errors
- **Security**: Any security-related improvements or vulnerability fixes

Please generate ONLY the markdown changelog content, starting with the appropriate version header.`;

	return prompt;
}

/**
 * Creates a Claude Code CLI provider if available.
 *
 * @returns Claude Code CLI provider or undefined if not configured.
 */
function createClaudeCodeCliProvider(): LlmProvider | undefined {
	const cliPath = Bun.env.CLAUDE_CODE_CLI_PATH;
	const model = Bun.env.CLAUDE_CODE_CLI_MODEL ?? "claude-sonnet-4-20250514";

	if (!cliPath) return undefined;

	return {
		name: "Claude Code CLI",
		callApi: async (prompt: string): Promise<string> => {
			try {
				const temporaryFile = `/tmp/changelog-prompt-${Date.now()}.md`;
				await writeFile(temporaryFile, prompt, "utf-8");

				const result = await $`${cliPath} --model ${model} --file ${temporaryFile}`.text();

				// Clean up temp file
				await $`rm ${temporaryFile}`.quiet();

				return result.trim();
			} catch (error) {
				throw new Error(`Claude Code CLI error: ${error}`);
			}
		},
	};
}

/**
 * Creates an Anthropic API provider if available.
 *
 * @returns Anthropic provider or undefined if not configured.
 */
function createAnthropicProvider(): LlmProvider | undefined {
	const apiKey = Bun.env.ANTHROPIC_API_KEY;

	if (!apiKey) return undefined;

	return {
		name: "Anthropic Claude",
		callApi: async (prompt: string): Promise<string> => {
			try {
				const response = await fetch("https://api.anthropic.com/v1/messages", {
					body: JSON.stringify({
						max_tokens: 4096,
						messages: [
							{
								content: prompt,
								role: "user",
							},
						],
						model: "claude-3-5-sonnet-20241022",
					}),
					headers: {
						"anthropic-version": "2023-06-01",
						"Content-Type": "application/json",
						"x-api-key": apiKey,
					},
					method: "POST",
				});

				if (!response.ok) {
					throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
				}

				const data = (await response.json()) as { content: Array<{ text: string }> };
				return data.content[0]?.text ?? "";
			} catch (error) {
				throw new Error(`Anthropic API error: ${error}`);
			}
		},
	};
}

/**
 * Creates an OpenAI API provider if available.
 *
 * @returns OpenAI provider or undefined if not configured.
 */
function createOpenAiProvider(): LlmProvider | undefined {
	const apiKey = Bun.env.OPENAI_API_KEY;
	const model = Bun.env.OPENAI_MODEL ?? "gpt-4o";

	if (!apiKey) return undefined;

	return {
		name: "OpenAI",
		callApi: async (prompt: string): Promise<string> => {
			try {
				const response = await fetch("https://api.openai.com/v1/chat/completions", {
					body: JSON.stringify({
						max_tokens: 4096,
						messages: [
							{
								content: prompt,
								role: "user",
							},
						],
						model,
					}),
					headers: {
						Authorization: `Bearer ${apiKey}`,
						"Content-Type": "application/json",
					},
					method: "POST",
				});

				if (!response.ok) {
					throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
				}

				const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
				return data.choices[0]?.message?.content ?? "";
			} catch (error) {
				throw new Error(`OpenAI API error: ${error}`);
			}
		},
	};
}

/**
 * Creates an OpenRouter API provider if available.
 *
 * @returns OpenRouter provider or undefined if not configured.
 */
function createOpenRouterProvider(): LlmProvider | undefined {
	const apiKey = Bun.env.OPEN_ROUTER_API_KEY;
	const model = Bun.env.OPEN_ROUTER_MODEL ?? "anthropic/claude-3.5-sonnet";

	if (!apiKey) return undefined;

	return {
		name: "OpenRouter",
		callApi: async (prompt: string): Promise<string> => {
			try {
				const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
					body: JSON.stringify({
						max_tokens: 4096,
						messages: [
							{
								content: prompt,
								role: "user",
							},
						],
						model,
					}),
					headers: {
						Authorization: `Bearer ${apiKey}`,
						"Content-Type": "application/json",
						"HTTP-Referer": "https://github.com/howmanysmall/pendant",
						"X-Title": "Pendant Changelog Generator",
					},
					method: "POST",
				});

				if (!response.ok) {
					throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
				}

				const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
				return data.choices[0]?.message?.content ?? "";
			} catch (error) {
				throw new Error(`OpenRouter API error: ${error}`);
			}
		},
	};
}

/**
 * Gets the first available LLM provider based on environment variables.
 * Priority: Claude Code CLI > OpenAI > Anthropic > OpenRouter.
 *
 * @returns The first available LLM provider or undefined if none are
 *   configured.
 */
function getAvailableLlmProvider(): LlmProvider | undefined {
	// Priority order as requested
	const providers = [
		createClaudeCodeCliProvider,
		createOpenAiProvider,
		createAnthropicProvider,
		createOpenRouterProvider,
	];

	for (const createProvider of providers) {
		const provider = createProvider();
		if (provider) return provider;
	}

	return undefined;
}

/**
 * Outputs the generated prompt to stdout with formatting.
 *
 * @param prompt - The prompt to output.
 */
function outputPrompt(prompt: string): void {
	consoleLog(`\n${"=".repeat(80)}`);
	consoleLog("📋 CHANGELOG GENERATION PROMPT");
	consoleLog("=".repeat(80));
	consoleLog();
	consoleLog(prompt);
	consoleLog();
	consoleLog("=".repeat(80));
	consoleLog("✅ Prompt generated successfully!");
	consoleLog("📋 Copy the above prompt and provide it to your preferred LLM.");
}

async function generateChangelogDataAsync(config: ChangelogConfig): Promise<ChangelogData> {
	consoleLog("📊 Analyzing project structure...");
	const project = await analyzeProjectStructureAsync();

	consoleLog("📝 Collecting git commits...");
	const commits = await getCommitsAsync(config.fromTag, config.maxCommits);

	consoleLog("📦 Checking current release diff...");
	const releaseDiff = config.includeDiff ? await getCurrentReleaseDiffAsync() : undefined;

	// For now, we'll return empty arrays for PR and issues since we'd need GitHub API
	// This can be enhanced later with actual GitHub API integration
	const pullRequests: ReadonlyArray<PullRequest> = [];
	const issues: ReadonlyArray<GitHubIssue> = [];

	return {
		commits,
		config,
		issues,
		project,
		pullRequests,
		releaseDiff,
	};
}

/** Main execution function. */
async function main(): Promise<void> {
	try {
		// Get repository information
		const { owner, repository } = await getRepositoryInfoAsync();

		// Get the latest tag for comparison
		const latestTag = await getLatestTagAsync();

		// Configuration
		const config: ChangelogConfig = {
			fromTag: latestTag,
			includeDiff: true,
			maxCommits: 50,
			maxIssues: 20,
			maxPullRequests: 20,
			owner,
			repository,
			toTag: "HEAD",
		};

		consoleLog(`🔍 Generating changelog for ${owner}/${repository}`);
		consoleLog(`📅 From: ${latestTag ?? "initial commit"} → HEAD`);

		// Collect changelog data
		const data = await generateChangelogDataAsync(config);

		// Generate prompt
		const prompt = generateChangelogPrompt(data);

		// Check for LLM provider
		const llmProvider = getAvailableLlmProvider();

		if (llmProvider) {
			consoleLog(`🤖 Using ${llmProvider.name} to generate changelog...`);

			try {
				const changelog = await llmProvider.callApi(prompt);

				// Output the generated changelog
				consoleLog(`\n${"=".repeat(80)}`);
				consoleLog("� GENERATED CHANGELOG");
				consoleLog("=".repeat(80));
				consoleLog();
				consoleLog(changelog);
				consoleLog();
				consoleLog("=".repeat(80));
				consoleLog("✅ Changelog generated successfully!");
			} catch (error) {
				consoleError(`❌ LLM API error: ${error}`);
				consoleLog("📋 Falling back to prompt generation...");

				// Fall back to showing the prompt
				outputPrompt(prompt);
			}
		} else {
			consoleLog("ℹ️  No LLM provider configured. Generating prompt only...");
			outputPrompt(prompt);
		}
	} catch (error) {
		consoleError("❌ Error generating changelog:", error);
		process.exit(1);
	}
}

// Execute if this is the main module
await main();
