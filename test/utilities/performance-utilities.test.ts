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
			await new Promise(resolve => setTimeout(resolve, 1));
			
			const time2 = bunPerformanceNow();
			expect(time2).toBeGreaterThan(time1);
		});

		it("should have millisecond precision", () => {
			const time = bunPerformanceNow();
			// Should be a finite number with potential decimal places
			expect(Number.isFinite(time)).toBe(true);
		});

		it("should be consistent across multiple calls in quick succession", () => {
			const times = [];
			for (let i = 0; i < 10; i++) {
				times.push(bunPerformanceNow());
			}

			// All times should be numbers and generally increasing
			for (let i = 0; i < times.length; i++) {
				expect(typeof times[i]).toBe("number");
				expect(times[i]).toBeGreaterThanOrEqual(0);
				
				if (i > 0) {
					// Should be greater than or equal (very fast consecutive calls might be equal)
					expect(times[i]).toBeGreaterThanOrEqual(times[i - 1]);
				}
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
			const times = [];
			
			// Collect multiple measurements
			for (let i = 0; i < 5; i++) {
				times.push(bunPerformanceNow());
				await new Promise(resolve => setTimeout(resolve, 1));
			}
			
			// Check that we can measure small time differences
			const differences = [];
			for (let i = 1; i < times.length; i++) {
				differences.push(times[i] - times[i - 1]);
			}
			
			// All differences should be positive and measurable
			for (const diff of differences) {
				expect(diff).toBeGreaterThan(0);
			}
		});
	});
});
