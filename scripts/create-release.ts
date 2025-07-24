#!/usr/bin/env buns
/* eslint-disable camelcase -- useless */
/* eslint-disable max-lines-per-function -- annoying */

/**
 * Script to create a GitHub release with automated version management.
 *
 * This script will:
 *
 * - Validate the current git state
 * - Update package.json version
 * - Create a git tag
 * - Create a GitHub release
 * - Trigger the build workflow.
 *
 * @example
 *
 * ```bash
 * # Create a patch release (0.1.0 -> 0.1.1)
 * bun run scripts/create-release.ts patch
 *
 * # Create a minor release (0.1.0 -> 0.2.0)
 * bun run scripts/create-release.ts minor
 *
 * # Create a major release (0.1.0 -> 1.0.0)
 * bun run scripts/create-release.ts major
 *
 * # Create a specific version
 * bun run scripts/create-release.ts --version 1.2.3
 * ```
 */

import { Octokit } from "@octokit/rest";

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";

import scriptConsole from "./utilities/script-console";

const PACKAGE_JSON = "package.json";

interface PackageJson {
	readonly description: string;
	readonly name: string;
	readonly [key: string]: unknown;
	readonly repository: {
		readonly type: string;
		readonly url: string;
	};
	readonly version: string;
}

/** Configuration for the release script. */
interface ReleaseConfig {
	/** The type of version bump to perform. */
	readonly bumpType?: "major" | "minor" | "patch";
	/** Whether to create a pre-release. */
	readonly prerelease?: boolean;
	/** Whether to skip confirmation prompts. */
	readonly skipConfirmation?: boolean;
	/** Specific version to set (overrides bumpType). */
	readonly version?: string;
}

/**
 * Parses command line arguments to extract release configuration.
 *
 * @returns The parsed release configuration.
 */
function parseArgumentsAsync(): ReleaseConfig {
	const { positionals, values } = parseArgs({
		allowPositionals: true,
		args: Bun.argv.slice(2),
		options: {
			prerelease: {
				short: "p",
				type: "boolean",
			},
			"skip-confirmation": {
				short: "y",
				type: "boolean",
			},
			version: {
				short: "v",
				type: "string",
			},
		},
	});

	const bumpType = positionals[0] as "major" | "minor" | "patch" | undefined;

	return {
		bumpType,
		prerelease: values.prerelease ?? false,
		skipConfirmation: values["skip-confirmation"] ?? false,
		version: values.version,
	};
}

/**
 * Reads and parses the package.json file.
 *
 * @returns The parsed package.json content.
 */
async function readPackageJsonAsync(): Promise<PackageJson> {
	const packagePath = join(process.cwd(), PACKAGE_JSON);
	const content = await readFile(packagePath, "utf8");
	return JSON.parse(content) as PackageJson;
}

/**
 * Writes the updated package.json file.
 *
 * @param packageData - The package.json data to write.
 */
async function writePackageJsonAsync(packageData: PackageJson): Promise<void> {
	const packagePath = join(process.cwd(), PACKAGE_JSON);
	const content = JSON.stringify(packageData, null, "\t");
	await writeFile(packagePath, `${content}\n`);
}

/**
 * Bumps a semantic version string.
 *
 * @param currentVersion - The current version string.
 * @param bumpType - The type of bump to perform.
 * @returns The new version string.
 */
function bumpVersion(currentVersion: string, bumpType: "major" | "minor" | "patch"): string {
	const versionParts = currentVersion.split(".").map(Number);
	if (versionParts.length !== 3 || versionParts.some(Number.isNaN))
		throw new Error(`Invalid version format: ${currentVersion}`);

	const [major, minor, patch] = versionParts as [number, number, number];

	switch (bumpType) {
		case "major": {
			return `${major + 1}.0.0`;
		}

		case "minor": {
			return `${major}.${minor + 1}.0`;
		}

		case "patch": {
			return `${major}.${minor}.${patch + 1}`;
		}

		default: {
			throw new Error(`Invalid bump type: ${bumpType}`);
		}
	}
}

/** Validates that the git repository is in a clean state. */
async function validateGitStateAsync(): Promise<void> {
	scriptConsole.info("🔍 Validating git state...");

	// Check if we're in a git repository
	const isGitRepo = await Bun.spawn(["git", "rev-parse", "--git-dir"], {
		stderr: "ignore",
		stdout: "ignore",
	}).exited;
	if (isGitRepo !== 0) throw new Error("Not in a git repository");

	// Check if we're on the main branch
	const currentBranchProcess = Bun.spawn(["git", "branch", "--show-current"], {
		stdout: "pipe",
	});
	const currentBranch = await new Response(currentBranchProcess.stdout).text();
	if (currentBranch.trim() !== "main") throw new Error(`Not on main branch (currently on: ${currentBranch.trim()})`);

	// Check if working directory is clean
	const gitStatusProcess = Bun.spawn(["git", "status", "--porcelain"], {
		stdout: "pipe",
	});
	const gitStatus = await new Response(gitStatusProcess.stdout).text();
	if (gitStatus.trim()) throw new Error("Working directory is not clean. Please commit or stash your changes.");

	// Check if we're up to date with remote
	await Bun.spawn(["git", "fetch"]).exited;

	const localCommitProcess = Bun.spawn(["git", "rev-parse", "HEAD"], {
		stdout: "pipe",
	});
	const localCommit = await new Response(localCommitProcess.stdout).text();

	const remoteCommitProcess = Bun.spawn(["git", "rev-parse", "origin/main"], {
		stdout: "pipe",
	});
	const remoteCommit = await new Response(remoteCommitProcess.stdout).text();

	if (localCommit.trim() !== remoteCommit.trim())
		throw new Error("Local branch is not up to date with remote. Please pull the latest changes.");

	scriptConsole.info("✅ Git state is valid");
}

/** Runs tests to ensure the project is in a good state for release. */
async function runTestsAsync(): Promise<void> {
	scriptConsole.info("🧪 Running tests...");

	const testResult = await Bun.spawn(["bun", "test"], {
		stderr: "inherit",
		stdout: "inherit",
	}).exited;

	if (testResult !== 0) throw new Error("Tests failed. Please fix failing tests before releasing.");
	scriptConsole.info("✅ All tests passed");
}

/** Runs the build process to ensure the project builds successfully. */
async function runBuildAsync(): Promise<void> {
	scriptConsole.info("🔨 Building project...");

	const buildResult = await Bun.spawn(["bun", "run", "build"], {
		stderr: "inherit",
		stdout: "inherit",
	}).exited;

	if (buildResult !== 0) throw new Error("Build failed. Please fix build errors before releasing.");
	scriptConsole.info("✅ Build completed successfully");
}

/**
 * Creates a git tag for the release.
 *
 * @param version - The version to tag.
 */
async function createGitTagAsync(version: string): Promise<void> {
	scriptConsole.info(`🏷️  Creating git tag v${version}...`);

	const tagResult = await Bun.spawn(["git", "tag", `v${version}`], {
		stderr: "inherit",
		stdout: "inherit",
	}).exited;
	if (tagResult !== 0) throw new Error("Failed to create git tag");

	const pushResult = await Bun.spawn(["git", "push", "origin", `v${version}`], {
		stderr: "inherit",
		stdout: "inherit",
	}).exited;
	if (pushResult !== 0) throw new Error("Failed to push git tag");

	scriptConsole.info("✅ Git tag created and pushed");
}

/**
 * Generates release notes based on git commits since the last tag.
 *
 * @param version - The version being released.
 * @returns Generated release notes.
 */
async function generateReleaseNotesAsync(version: string): Promise<string> {
	scriptConsole.info("📝 Generating release notes...");

	// Get the last tag
	const lastTagResult = Bun.spawn(["git", "describe", "--tags", "--abbrev=0"], {
		stderr: "pipe",
		stdout: "pipe",
	});

	let commitRange = "HEAD";
	if (lastTagResult.exitCode === 0) {
		const lastTagResponse = await new Response(lastTagResult.stdout).text();
		const lastTag = lastTagResponse.trim();
		commitRange = `${lastTag}..HEAD`;
	}

	// Get commits since last tag
	const commitsProcess = Bun.spawn(["git", "log", commitRange, "--pretty=format:- %s", "--no-merges"], {
		stdout: "pipe",
	});

	const commitsResponse = await new Response(commitsProcess.stdout).text();
	const commits = commitsResponse.trim();

	return `## What's Changed

${commits || "- Initial release"}

**Full Changelog**: https://github.com/howmanysmall/pendant/compare/v${version}

## Installation

Download the appropriate binary for your platform from the assets below:

- **Windows (x64)**: \`pendant-windows-x64.zip\`
- **macOS (Intel)**: \`pendant-macos-x64.tar.gz\`
- **macOS (Apple Silicon)**: \`pendant-macos-arm64.tar.gz\`
- **Linux (x64)**: \`pendant-linux-x64.tar.gz\`
- **Linux (ARM64)**: \`pendant-linux-arm64.tar.gz\`

Or install via npm:
\`\`\`bash
npm install -g pendant
\`\`\``;
}

/**
 * Creates a GitHub release.
 *
 * @param version - The version to release.
 * @param releaseNotes - The release notes content.
 * @param isPrerelease - Whether this is a pre-release.
 */
async function createGitHubReleaseAsync(version: string, releaseNotes: string, isPrerelease: boolean): Promise<void> {
	scriptConsole.info(`🚀 Creating GitHub release v${version}...`);

	const token = Bun.env.GITHUB_TOKEN;
	if (!token) throw new Error("GITHUB_TOKEN environment variable is required");

	const octokit = new Octokit({ auth: token });

	try {
		const release = await octokit.rest.repos.createRelease({
			name: `v${version}`,
			body: releaseNotes,
			generate_release_notes: false,
			owner: "howmanysmall",
			prerelease: isPrerelease,
			repo: "pendant",
			tag_name: `v${version}`,
		});

		scriptConsole.info(`✅ GitHub release created: ${release.data.html_url}`);
	} catch (error) {
		throw new Error(`Failed to create GitHub release: ${error}`);
	}
}

/**
 * Prompts the user for confirmation.
 *
 * @param message - The confirmation message.
 * @returns Whether the user confirmed.
 */
async function confirmAsync(message: string): Promise<boolean> {
	scriptConsole.info(`${message} (y/N)`);

	for await (const line of console) {
		const answer = line.trim().toLowerCase();
		if (answer === "y" || answer === "yes") return true;
		if (answer === "n" || answer === "no" || answer === "") return false;
		scriptConsole.info("Please answer y or n:");
	}

	return false;
}

/** Main function that orchestrates the release process. */
async function mainAsync(): Promise<void> {
	try {
		scriptConsole.info("🎯 Starting release process...\n");

		const config = parseArgumentsAsync();
		const packageJson = await readPackageJsonAsync();

		// Determine the new version
		let newVersion: string;
		if (config.version) newVersion = config.version;
		else if (config.bumpType) newVersion = bumpVersion(packageJson.version, config.bumpType);
		else
			throw new Error(
				"Please specify either a bump type (major|minor|patch) or a specific version with --version",
			);

		scriptConsole.info(`📦 Current version: ${packageJson.version}`);
		scriptConsole.info(`📦 New version: ${newVersion}`);
		scriptConsole.info(`🎭 Pre-release: ${config.prerelease}\n`);

		// Confirm the release
		if (!config.skipConfirmation) {
			const confirmed = await confirmAsync(`Proceed with release v${newVersion}?`);
			if (!confirmed) {
				scriptConsole.info("❌ Release cancelled");
				process.exit(0);
			}
		}

		// Validate git state
		await validateGitStateAsync();

		// Run tests and build
		await runTestsAsync();
		await runBuildAsync();

		// Update package.json
		scriptConsole.info("📝 Updating package.json...");
		const updatedPackageJson = { ...packageJson, version: newVersion };
		await writePackageJsonAsync(updatedPackageJson);

		// Commit the version change
		scriptConsole.info("💾 Committing version change...");
		await Bun.spawn(["git", "add", PACKAGE_JSON]).exited;
		await Bun.spawn(["git", "commit", "-m", `chore: bump version to ${newVersion}`]).exited;
		await Bun.spawn(["git", "push"]).exited;

		// Create git tag
		await createGitTagAsync(newVersion);

		// Generate release notes
		const releaseNotes = await generateReleaseNotesAsync(newVersion);

		// Create GitHub release
		await createGitHubReleaseAsync(newVersion, releaseNotes, config.prerelease ?? false);

		scriptConsole.info("\n🎉 Release completed successfully!");
		scriptConsole.info(`📦 Version: v${newVersion}`);
		scriptConsole.info("🔄 GitHub Actions will now build the binaries automatically");
		scriptConsole.info("🔗 View release: https://github.com/howmanysmall/pendant/releases");
	} catch (error) {
		scriptConsole.error(`❌ Release failed: ${error instanceof Error ? error.message : String(error)}`);
		process.exit(1);
	}
}

// Only run if this script is executed directly
if (import.meta.main) await mainAsync();
