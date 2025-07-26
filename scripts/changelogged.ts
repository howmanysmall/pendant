#!/usr/bin/env bun
/* eslint-disable max-lines-per-function -- sybau */

import { $ } from "bun";
import { logger } from "logging/logger";
import { writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * @file This script generates a changelog based on Conventional Commits since
 *   the last Git tag. It follows the format specified in "Keep a Changelog".
 * @see https://keepachangelog.com/en/1.1.0/
 * @see https://www.conventionalcommits.org/en/v1.0.0/
 */

/** Describes the categorized changes based on Conventional Commit types. */
interface CategorizedChanges {
	/** New features (`feat`). */
	readonly Added: Array<string>;
	/** Changes to existing functionality (`perf`, `refactor`). */
	readonly Changed: Array<string>;
	/** Bug fixes (`fix`). */
	readonly Fixed: Array<string>;
	/** Reverted commits (`revert`). */
	readonly Reverted: Array<string>;
}

/**
 * Fetches the latest Git tag from the repository.
 *
 * @returns A promise that resolves to the latest tag name, or `undefined` if no
 *   tags are found.
 */
async function getLatestTagAsync(): Promise<string | undefined> {
	try {
		const result = await $`git describe --tags --abbrev=0`.text();
		return result.trim();
	} catch {
		logger.warn("Could not find any git tags. The changelog will be generated from all commits.");
		return undefined;
	}
}

/**
 * Fetches commit messages since a given tag.
 *
 * @param latestTag - The tag to get commits since. If undefined, all commits
 *   are fetched.
 * @returns A promise that resolves to an array of commit subjects.
 */
async function getCommitsSinceTagAsync(latestTag?: string): Promise<Array<string>> {
	const commitRange = latestTag ? `${latestTag}..HEAD` : "HEAD";
	try {
		const commitsRaw = await $`git log ${commitRange} --pretty=format:"%s"`.text();
		return commitsRaw.trim().split("\n").filter(Boolean);
	} catch {
		logger.error(`Failed to get commits using range: ${commitRange}`);
		return [];
	}
}

/**
 * Parses commit messages and categorizes them based on the Conventional Commits
 * specification.
 *
 * @param commits - An array of commit subjects.
 * @returns An object with categorized changes.
 */

function categorizeCommits(commits: Array<string>): CategorizedChanges {
	const changes: CategorizedChanges = {
		Added: [],
		Changed: [],
		Fixed: [],
		Reverted: [],
	};

	const conventionalCommitRegex =
		/^(?<type>feat|fix|perf|refactor|revert|chore|docs|style|test)(?<scope>\(.*\))?:\s(?<subject>.+)/;

	for (const commit of commits) {
		const match = commit.match(conventionalCommitRegex);

		if (!match?.groups) {
			changes.Changed.push(commit);
			continue;
		}

		const { subject, type } = match.groups;
		if (subject === undefined || type === undefined) continue;

		switch (type) {
			case "feat": {
				changes.Added.push(subject);
				break;
			}
			case "fix": {
				changes.Fixed.push(subject);
				break;
			}
			case "perf":
			case "refactor": {
				changes.Changed.push(subject);
				break;
			}
			case "revert": {
				changes.Reverted.push(subject);
				break;
			}
			// Other types like 'chore', 'docs', 'style', 'test' are ignored.
		}
	}
	return changes;
}

/**
 * Generates a changelog in Markdown format.
 *
 * @remarks
 * This function currently does not generate a `Removed` section as it's not a
 * standard Conventional Commit type. This could be implemented by parsing
 * `BREAKING CHANGE` footers.
 * @param changes - The categorized changes.
 * @param latestTag - The latest tag, used for generating the comparison link.
 * @returns A promise that resolves to the changelog content as a string.
 */
async function generateChangelogMarkdownAsync(changes: CategorizedChanges, latestTag?: string): Promise<string> {
	let output = "# Changelog\n\n";
	output += "All notable changes to this project will be documented in this file.\n\n";
	output += "The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),\n";
	output += "and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).\n\n";
	output += "## [Unreleased]\n\n";

	let hasChanges = false;
	for (const [category, items] of Object.entries(changes))
		if (items.length > 0) {
			hasChanges = true;
			output += `### ${category}\n\n`;
			for (const item of items) output += `- ${item}\n`;
			output += "\n";
		}

	if (!hasChanges) output += "No notable changes since the last release.\n\n";

	if (latestTag)
		try {
			const repoUrlResult = await $`git remote get-url origin`.text();
			const repoUrl = repoUrlResult.trim().replace(/\\.git$/, "");
			output += `[unreleased]: ${repoUrl}/compare/${latestTag}...HEAD\n`;
		} catch {
			logger.warn("Could not determine git remote URL. Skipping comparison link.");
		}

	return output;
}

/** The main function to generate and print the changelog. */
async function mainAsync() {
	logger.info("Generating changelog...");

	const latestTag = await getLatestTagAsync();
	if (latestTag) {
		logger.info(`Found latest tag: ${latestTag}`);
	}

	const commits = await getCommitsSinceTagAsync(latestTag);
	logger.info(`Found ${commits.length} commits to process.`);

	const categorizedChanges = categorizeCommits(commits);
	const markdown = await generateChangelogMarkdownAsync(categorizedChanges, latestTag);

	const changelogPath = path.join(process.cwd(), "CHANGELOG-UPDATE.md");
	await writeFile(changelogPath, markdown, "utf-8");

	logger.info(`Changelog written to ${changelogPath}`);
}

await mainAsync();
