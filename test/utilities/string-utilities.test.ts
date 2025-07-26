import { describe, expect, it } from "bun:test";
import { addQuoted, escapeString, getSignificantDigits } from "utilities/string-utilities";

describe("string-utilities", () => {
	describe("escapeString", () => {
		it("should escape control characters", () => {
			expect(escapeString("\n")).toBe("\\u000a");
			expect(escapeString("\r")).toBe("\\u000d");
			expect(escapeString("\t")).toBe("\\u0009");
			expect(escapeString("\0")).toBe("\\u0000");
		});

		it("should escape backslashes and quotes", () => {
			expect(escapeString("\\")).toBe("\\u005c");
			expect(escapeString('"')).toBe("\\u0022");
		});

		it("should leave regular characters unchanged", () => {
			expect(escapeString("hello")).toBe("hello");
			expect(escapeString("Hello World 123")).toBe("Hello World 123");
		});

		it("should handle mixed content", () => {
			expect(escapeString('hello\nworld"test\\')).toBe("hello\\u000aworld\\u0022test\\u005c");
		});

		it("should handle empty string", () => {
			expect(escapeString("")).toBe("");
		});

		it("should handle special characters", () => {
			expect(escapeString("åäö")).toBe("åäö"); // Non-ASCII but > 0x1f
		});

		it("should escape all control characters (0x00-0x1f)", () => {
			for (let index = 0; index <= 0x1f; index += 1) {
				const character = String.fromCharCode(index);
				const escaped = escapeString(character);

				expect(escaped).toMatch(/\\u[0-9a-f]{4}/);
			}
		});
	});

	describe("getSignificantDigits", () => {
		it("should handle integers", () => {
			expect(getSignificantDigits(123)).toBe("123");
			expect(getSignificantDigits(0)).toBe("0");
			expect(getSignificantDigits(-456)).toBe("-456");
		});

		it("should handle simple decimals", () => {
			expect(getSignificantDigits(1.5)).toBe("1.5");
			expect(getSignificantDigits(0.25)).toBe("0.25");
		});

		it("should handle floating point precision issues", () => {
			// Test cases where floating point precision matters
			const result = getSignificantDigits(0.1 + 0.2);

			expect(typeof result).toBe("string");
			expect(Number(result)).toBeCloseTo(0.3);
		});

		it("should handle very small numbers", () => {
			const result = getSignificantDigits(1e-10);

			expect(typeof result).toBe("string");
			expect(Number(result)).toBe(1e-10);
		});

		it("should handle very large numbers", () => {
			const result = getSignificantDigits(1e10);

			expect(typeof result).toBe("string");
			expect(Number(result)).toBe(1e10);
		});

		it("should handle negative numbers", () => {
			expect(getSignificantDigits(-1.23)).toBe("-1.23");
			expect(getSignificantDigits(-0.001)).toBe("-0.001");
		});

		it("should find minimal precision representation", () => {
			// Test that it finds the shortest accurate representation
			const number = 1.0000000000000002;
			const result = getSignificantDigits(number);

			expect(Number(result)).toBe(number);
		});

		it("should handle edge cases", () => {
			expect(getSignificantDigits(Number.MAX_SAFE_INTEGER)).toBeDefined();
			expect(getSignificantDigits(Number.MIN_SAFE_INTEGER)).toBeDefined();
		});

		it("should preserve accuracy for complex decimals", () => {
			const testNumbers = [Math.PI, Math.E, 1 / 3, 1 / 7, Math.sqrt(2)];

			for (const number of testNumbers) {
				const result = getSignificantDigits(number);

				expect(Number(result)).toBe(number);
			}
		});

		it("should handle numbers that require precision adjustments", () => {
			// Test numbers that will trigger the binary search algorithm
			const problematicNumbers = [1.9999999999999998, 0.123456789012345, 1.000000000000001];

			for (const number of problematicNumbers) {
				const result = getSignificantDigits(number);

				expect(Number(result)).toBe(number);
				expect(typeof result).toBe("string");
			}
		});
	});

	describe("addQuoted", () => {
		it("should add quotes around simple strings", () => {
			expect(addQuoted("hello")).toBe('"hello"');
			expect(addQuoted("world")).toBe('"world"');
		});

		it("should escape special characters", () => {
			expect(addQuoted("hello\nworld")).toBe('"hello\\nworld"');
			expect(addQuoted("hello\rworld")).toBe('"hello\\rworld"');
			expect(addQuoted("hello\0world")).toBe('"hello\\0world"');
		});

		it("should escape quotes and backslashes", () => {
			expect(addQuoted('say "hello"')).toBe('"say \\"hello\\""');
			expect(addQuoted("path\\to\\file")).toBe('"path\\\\to\\\\file"');
		});

		it("should handle empty string", () => {
			expect(addQuoted("")).toBe('""');
		});

		it("should handle mixed special characters", () => {
			expect(addQuoted('line1\nline2\r"quoted"\\')).toBe('"line1\\nline2\\r\\"quoted\\"\\\\"');
		});

		it("should handle all escape sequences", () => {
			expect(addQuoted('test\n\r\0"\\more')).toBe('"test\\n\\r\\0\\"\\\\more"');
		});

		it("should preserve regular characters", () => {
			expect(addQuoted("Regular text with spaces and 123")).toBe('"Regular text with spaces and 123"');
		});

		it("should handle unicode characters", () => {
			expect(addQuoted("åäö")).toBe('"åäö"');
			expect(addQuoted("😀🎉")).toBe('"😀🎉"');
		});
	});

	describe("cross-platform string handling", () => {
		it("should handle platform-specific line endings", () => {
			// Windows CRLF
			expect(addQuoted("line1\r\nline2")).toBe('"line1\\r\\nline2"');
			// Unix LF
			expect(addQuoted("line1\nline2")).toBe('"line1\\nline2"');
			// Old Mac CR
			expect(addQuoted("line1\rline2")).toBe('"line1\\rline2"');
		});

		it("should handle path-like strings", () => {
			// Windows paths
			expect(addQuoted("C:\\Users\\test\\file.txt")).toBe('"C:\\\\Users\\\\test\\\\file.txt"');
			// Unix paths
			expect(addQuoted("/home/test/file.txt")).toBe('"/home/test/file.txt"');
		});

		it("should maintain consistency across platforms", () => {
			const testStrings = [
				"simple text",
				"text with\nlinebreak",
				'text with "quotes"',
				"text with \\ backslash",
				'mixed\nspecial"chars\\here',
			];

			for (const testString of testStrings) {
				const quoted = addQuoted(testString);

				expect(quoted.startsWith('"')).toBe(true);
				expect(quoted.endsWith('"')).toBe(true);
			}
		});
	});
});
