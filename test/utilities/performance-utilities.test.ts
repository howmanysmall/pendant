import { describe, expect, it } from "bun:test";
import { bunPerformanceNow } from "utilities/performance-utilities";

describe("PerformanceUtilities", () => {
	describe("bunPerformanceNow", () => {
		it("should return a number", () => {
			const now = bunPerformanceNow();

			expect(typeof now).toBe("number");
		});
	});
});
