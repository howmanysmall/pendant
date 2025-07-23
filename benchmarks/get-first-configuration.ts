#!/usr/bin/env bun

import { barplot, bench, run } from "mitata";
import { stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
	getFirstConfigurationAsync,
	getFirstConfigurationGlob2Async,
	getFirstConfigurationGlob3Async,
	getFirstConfigurationGlobAsync,
} from "utilities/configuration-utilities";
import { getChildrenAsync } from "utilities/file-system-utilities";

import UniqueRandom from "./classes/unique-random";

const CONFIGURATION_FILES = join(import.meta.dirname, "configuration-files");
const DIRECTORIES_DATA_SIZE = 1000;

const possibleDirectories = new Array<string>();

{
	const children = await getChildrenAsync(CONFIGURATION_FILES);
	for (const childPath of children) {
		const resolvedPath = resolve(childPath);
		const stats = await stat(resolvedPath);
		if (stats.isDirectory()) possibleDirectories.push(resolvedPath);
	}
}

const directoriesToUse = new Array<string>(DIRECTORIES_DATA_SIZE);
const randomLibrary = new UniqueRandom();
for (let index = 0; index < DIRECTORIES_DATA_SIZE; index += 1) {
	const directory = possibleDirectories[randomLibrary.nextInteger(0, possibleDirectories.length - 1)];
	if (directory === undefined) throw new Error("No directories found in configuration files.");
	directoriesToUse[index] = directory;
}

// validate it works properly
{
	const consoleWarn = console.error;
	const consoleLog = console.log;
	function threwError(error: unknown): string {
		return `Function threw error: ${error instanceof Error ? error.message : String(error)}`;
	}
	function noOperationReturn(error: unknown): string {
		consoleWarn(`Function threw error: ${error instanceof Error ? error.message : String(error)}`);
		return "Failure";
	}

	const matchesThrewError = /^Function threw error:/;

	function isSame(a: unknown, b: unknown): boolean {
		if (typeof a === "string" && typeof b === "string") {
			if (matchesThrewError.test(a) && matchesThrewError.test(b)) return true;
			return a === b;
		}

		return a === b;
	}

	for (const directory of possibleDirectories) {
		const version1 = await getFirstConfigurationAsync(directory).catch(noOperationReturn);
		const version2 = await getFirstConfigurationGlobAsync(directory).catch(noOperationReturn);
		const version3 = await getFirstConfigurationGlob2Async(directory).catch(noOperationReturn);
		const version4 = await getFirstConfigurationGlob3Async(directory).catch(noOperationReturn);

		if (version1 !== version2 || version1 !== version3 || version1 !== version4)
			throw new Error(
				`Versions do not match for directory "${directory}":\n- Version 1: ${version1}\n- Version 2: ${version2}\n- Version 3: ${version3}\n- Version 4: ${version4}`,
			);
		consoleLog(`All versions match for directory "${directory}": ${version1}`);
	}
}

function noOperation(): void {
	// does nothing!
}

barplot(() => {
	bench("getFirstConfigurationAsync", async () => {
		for (const directory of directoriesToUse) await getFirstConfigurationAsync(directory).catch(noOperation);
	});
	bench("getFirstConfigurationGlobAsync", async () => {
		for (const directory of directoriesToUse) await getFirstConfigurationGlobAsync(directory).catch(noOperation);
	});
	bench("getFirstConfigurationGlob2Async", async () => {
		for (const directory of directoriesToUse) await getFirstConfigurationGlob2Async(directory).catch(noOperation);
	});
	bench("getFirstConfigurationGlob3Async", async () => {
		for (const directory of directoriesToUse) await getFirstConfigurationGlob3Async(directory).catch(noOperation);
	});
});

await run({});
