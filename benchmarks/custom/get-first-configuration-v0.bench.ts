#!/usr/bin/env bun

import chalk from "chalk";
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

interface BenchmarkOptions {
	readonly directoryName: string;
	readonly iterations?: number;
}

async function benchmarkCurrentAsync({ directoryName, iterations = 100 }: BenchmarkOptions): Promise<BenchmarkResult> {
	const path = join(configurationFiles, directoryName);
	const startTime = bunPerformanceNow();

	for (let index = 0; index < iterations; index += 1) {
		try {
			await getFirstConfigurationAsync(path);
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

function printBenchmarkResult({ averageTime, callsPerSecond, directoryName, totalTime }: BenchmarkResult): void {
	const name = chalk.bold.cyan(directoryName.padEnd(28));
	const total = chalk.yellow(`${totalTime.toFixed(2).padStart(8)} ms`);
	const average = chalk.green(`${averageTime.toFixed(2).padStart(8)} ms`);
	const calls = chalk.magenta(callsPerSecond.toFixed(0).padStart(6));
	consoleLog(`${name} | Total: ${total} | Average: ${average} | Calls/sec: ${calls}`);
}

function printSummaryTable(results: Array<BenchmarkResult>): void {
	consoleLog(chalk.bold.underline("\nBenchmark Summary"));
	consoleLog(
		chalk.gray(
			"Directory".padEnd(28) +
				" | " +
				"Total Time".padStart(12) +
				" | " +
				"Average/Call".padStart(10) +
				" | " +
				"Calls/sec".padStart(10),
		),
	);
	consoleLog(chalk.gray("-".repeat(65)));
	for (const { averageTime, callsPerSecond, directoryName, totalTime } of results) {
		const name = directoryName.padEnd(28);
		const total = `${totalTime.toFixed(2).padStart(12)} ms`;
		const average = `${averageTime.toFixed(2).padStart(10)} ms`;
		const calls = callsPerSecond.toFixed(0).padStart(10);
		consoleLog(`${name} | ${total} | ${average} | ${calls}`);
	}
	consoleLog();
}

const directories = ["correctly-named-dot-pendant", "correctly-named-pendant", "incorrectly-named", "no-configuration"];

const results = new Array<BenchmarkResult>();
for (const directoryName of directories) {
	const result = await benchmarkCurrentAsync({ directoryName, iterations: 100 });
	printBenchmarkResult(result);
	results.push(result);
}

printSummaryTable(results);
