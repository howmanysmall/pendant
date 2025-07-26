/**
 * Returns the current high resolution millisecond timestamp, where 0 represents
 * the start of the current `Bun` process.
 *
 * This function provides microsecond precision timing and is optimized for
 * performance measurement scenarios.
 *
 * @returns The millisecond timestamp with microsecond precision.
 */
export function bunPerformanceNow(): number {
	return Bun.nanoseconds() / 1_000_000;
}

/**
 * Measures the execution time of a synchronous function.
 *
 * @template T - The return type of the function.
 * @param func - The function to measure.
 * @returns An object containing the execution time and result.
 */
export function measureSync<T>(func: () => T): { duration: number; result: T } {
	const start = bunPerformanceNow();
	const result = func();
	const duration = bunPerformanceNow() - start;
	return { duration, result };
}

/**
 * Measures the execution time of an asynchronous function.
 *
 * @template T - The return type of the function.
 * @param func - The async function to measure.
 * @returns A promise resolving to an object with the execution time and result.
 */
export async function measureAsync<T>(func: () => Promise<T>): Promise<{ duration: number; result: T }> {
	const start = bunPerformanceNow();
	const result = await func();
	const duration = bunPerformanceNow() - start;
	return { duration, result };
}
