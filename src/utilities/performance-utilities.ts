/**
 * Returns the current high resolution millisecond timestamp, where 0 represents
 * the start of the current `Bun` process.
 *
 * @returns The millisecond timestamp.
 */
export function bunPerformanceNow(): number {
	return Bun.nanoseconds() / 1_000_000;
}
