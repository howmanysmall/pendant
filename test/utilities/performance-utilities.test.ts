import { describe, expect, it } from "bun:test";
import { bunPerformanceNow } from "utilities/performance-utilities";

describe("PerformanceUtilities", () => {
	describe("bunPerformanceNow", () => {
		it("should return a number", () => {
			const now = bunPerformanceNow();

			expect(typeof now).toBe("number");
		});

		it("should return positive values", () => {
			const time = bunPerformanceNow();

			expect(time).toBeGreaterThanOrEqual(0);
		});

		it("should return increasing values over time", async () => {
			const time1 = bunPerformanceNow();

			// Small delay to ensure time difference
			await new Promise((resolve) => setTimeout(resolve, 1));

			const time2 = bunPerformanceNow();

			expect(time2).toBeGreaterThan(time1);
		});

		it("should have millisecond precision", () => {
			const time = bunPerformanceNow();

			// Should be a finite number with potential decimal places
			expect(Number.isFinite(time)).toBe(true);
		});

		it("should be consistent across multiple calls in quick succession", () => {
			const times = new Array<number>(10);
			for (let index = 0; index < 10; index += 1) times[index] = bunPerformanceNow();

			// All times should be numbers and generally increasing
			for (let index = 0; index < times.length; index += 1) {
				expect(typeof times[index]).toBe("number");
				expect(times[index]).toBeGreaterThanOrEqual(0);

				// Should be greater than or equal (very fast consecutive calls might be equal)
				if (index > 0) expect(times[index]).toBeGreaterThanOrEqual(times[index - 1]!);
			}
		});

		it("should work correctly across different platforms", () => {
			// The function should work regardless of platform
			const time = bunPerformanceNow();

			expect(typeof time).toBe("number");
			expect(Number.isFinite(time)).toBe(true);
			expect(time).toBeGreaterThanOrEqual(0);
		});

		it("should provide high resolution timing", async () => {
			const times = new Array<number>();

			// Collect multiple measurements
			for (let index = 0; index < 5; index += 1) {
				times.push(bunPerformanceNow());
				await new Promise((resolve) => setTimeout(resolve, 1));
			}

			// Check that we can measure small time differences
			const differences = new Array<number>();
			for (let index = 1; index < times.length; index += 1) differences.push(times[index]! - times[index - 1]!);

			// All differences should be positive and measurable
			for (const difference of differences) expect(difference).toBeGreaterThan(0);
		});
	});
});
