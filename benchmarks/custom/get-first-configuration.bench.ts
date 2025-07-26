#!/usr/bin/env bun

import chalk from "chalk";
import Table from "cli-table3";
import { join } from "node:path";
import { getFirstConfigurationAsync } from "utilities/configuration-utilities";
import { bunPerformanceNow } from "utilities/performance-utilities";

const consoleLog = console.log;
const configurationFiles = join(process.cwd(), "do-not-sync-ever", "benchmarks", "configuration-files");

/** Represents the result of a benchmark run. */
interface BenchmarkResult {
	/** Average time per call, in milliseconds. */
	readonly averageTime: number;
	/** Calls per second. */
	readonly callsPerSecond: number;
	/** The name of the directory tested. */
	readonly directoryName: string;
	/** Total time taken for all iterations, in milliseconds. */
	readonly totalTime: number;
}

/** Options for the benchmark function. */
interface BenchmarkOptions {
	/**
	 * The function to call for benchmarking.
	 *
	 * @param path - The path to the configuration directory.
	 * @returns A promise that resolves eventually.
	 */
	readonly callback: (path: string) => Promise<unknown>;
	/** The name of the directory to benchmark. */
	readonly directoryName: string;
	/** The number of iterations to run the benchmark. Defaults to 100. */
	readonly iterations?: number;
}

async function benchmarkAsync({
	callback,
	directoryName,
	iterations = 100,
}: BenchmarkOptions): Promise<BenchmarkResult> {
	const path = join(configurationFiles, directoryName);
	const startTime = bunPerformanceNow();

	for (let index = 0; index < iterations; index += 1) {
		try {
			await callback(path);
		} catch {
			// Expected to fail - no configuration found
		}
	}

	const finishTime = bunPerformanceNow();
	const totalTime = finishTime - startTime;
	const averageTime = totalTime / iterations;
	const callsPerSecond = 1000 / averageTime;

	return { averageTime, callsPerSecond, directoryName, totalTime };
}

function printSummaryTable(results: Array<BenchmarkResult>): void {
	const table = new Table({
		colAligns: ["left", "right", "right", "right"],
		head: [
			chalk.bold("Directory"),
			chalk.bold("Total Time (ms)"),
			chalk.bold("Average/Call (ms)"),
			chalk.bold("Calls/sec"),
		],
		style: { border: [], head: [] },
	});

	for (const result of results) {
		table.push([
			chalk.cyan(result.directoryName),
			chalk.yellow(result.totalTime.toFixed(2)),
			chalk.green(result.averageTime.toFixed(2)),
			chalk.magenta(result.callsPerSecond.toFixed(0)),
		]);
	}

	consoleLog(`\n${chalk.underline.bold("Benchmark Summary")}\n`);
	consoleLog(table.toString());
}

const directories = ["correctly-named-dot-pendant", "correctly-named-pendant", "incorrectly-named", "no-configuration"];

{
	const callback = getFirstConfigurationAsync;
	const results = await Promise.all(
		directories.map(async (directoryName) => benchmarkAsync({ callback, directoryName, iterations: 100 })),
	);

	printSummaryTable(results);
}
