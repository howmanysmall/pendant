import { describe, expect, it } from "bun:test";
import { makeJsonSafe, prettyJsonStringify } from "utilities/json-utilities";

describe("Json Utilities", () => {
	describe("prettyJsonStringify", () => {
		it("should handle null and undefined values", () => {
			expect(prettyJsonStringify(null)).toBe("null");
			expect(prettyJsonStringify(undefined)).toBe("null");
		});

		it("should handle boolean values", () => {
			expect(prettyJsonStringify(true)).toBe("true");
			expect(prettyJsonStringify(false)).toBe("false");
		});

		it("should handle string values", () => {
			expect(prettyJsonStringify("hello")).toBe('"hello"');
			expect(prettyJsonStringify("")).toBe('""');
		});

		it("should escape special characters in strings", () => {
			expect(prettyJsonStringify("hello\nworld")).toBe('"hello\\u000aworld"');
			expect(prettyJsonStringify('say "hello"')).toBe('"say \\u0022hello\\u0022"');
			expect(prettyJsonStringify("back\\slash")).toBe('"back\\u005cslash"');
			expect(prettyJsonStringify("\t\r\n")).toBe('"\\u0009\\u000d\\u000a"');
		});

		it("should handle number values", () => {
			expect(prettyJsonStringify(42)).toBe("42");
			expect(prettyJsonStringify(0)).toBe("0");
			expect(prettyJsonStringify(-1)).toBe("-1");
			expect(prettyJsonStringify(Math.PI)).toBe(Math.PI.toString());
		});

		it("should handle floating point precision", () => {
			const result = prettyJsonStringify(0.1 + 0.2);

			expect(Number(result)).toBe(0.1 + 0.2);
		});

		it("should handle empty arrays", () => {
			expect(prettyJsonStringify([])).toBe("[]");
		});

		it("should handle simple arrays", () => {
			const result = prettyJsonStringify([1, 2, 3]);
			const expected = "[\n\t1,\n\t2,\n\t3\n]";

			expect(result).toBe(expected);
		});

		it("should handle nested arrays", () => {
			const result = prettyJsonStringify([
				[1, 2],
				[3, 4],
			]);
			const expected = "[\n\t[\n\t\t1,\n\t\t2\n\t],\n\t[\n\t\t3,\n\t\t4\n\t]\n]";

			expect(result).toBe(expected);
		});

		it("should handle empty objects", () => {
			expect(prettyJsonStringify({})).toBe("{}");
		});

		it("should handle simple objects", () => {
			const result = prettyJsonStringify({ a: 1, b: 2 });
			const expected = '{\n\t"a": 1,\n\t"b": 2\n}';

			expect(result).toBe(expected);
		});

		it("should handle nested objects", () => {
			const result = prettyJsonStringify({
				active: true,
				user: { name: "John", age: 30 },
			});
			const expected = '{\n\t"active": true,\n\t"user": {\n\t\t"age": 30,\n\t\t"name": "John"\n\t}\n}';

			expect(result).toBe(expected);
		});

		it("should handle mixed arrays and objects", () => {
			const result = prettyJsonStringify([
				{ name: "Alice", scores: [85, 92] },
				{ name: "Bob", scores: [78, 88] },
			]);
			const expected =
				'[\n\t{\n\t\t"name": "Alice",\n\t\t"scores": [\n\t\t\t85,\n\t\t\t92\n\t\t]\n\t},\n\t{\n\t\t"name": "Bob",\n\t\t"scores": [\n\t\t\t78,\n\t\t\t88\n\t\t]\n\t}\n]';

			expect(result).toBe(expected);
		});

		it("should handle custom indent string", () => {
			const result = prettyJsonStringify({ a: 1, b: [2, 3] }, { indent: "  " });
			const expected = '{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}';

			expect(result).toBe(expected);
		});

		it("should handle custom indent level", () => {
			const result = prettyJsonStringify({ a: 1 }, { indentLevel: 2 });
			const expected = '{\n\t\t\t"a": 1\n\t\t}';

			expect(result).toBe(expected);
		});

		it("should handle custom sort function", () => {
			const shouldSort = (): boolean => true;
			/**
			 * Reverse alphabetical sort.
			 *
			 * @param a - First string to compare.
			 * @param b - Second string to compare.
			 * @returns Comparison result for reverse alphabetical order.
			 */
			const customSort = (a: string, b: string): number => b.localeCompare(a);

			const result = prettyJsonStringify(
				{ apple: 2, banana: 3, zebra: 1 },
				{ shouldUseSortFunction: shouldSort, sortKeys: customSort },
			);
			const expected = '{\n\t"zebra": 1,\n\t"banana": 3,\n\t"apple": 2\n}';

			expect(result).toBe(expected);
		});

		it("should handle sort function that returns false", () => {
			const shouldNotSort = (): boolean => false;
			const customSort = (a: string, b: string): number => b.localeCompare(a);

			const result = prettyJsonStringify(
				{ apple: 2, banana: 3, zebra: 1 },
				{ shouldUseSortFunction: shouldNotSort, sortKeys: customSort },
			);
			/**
			 * Should use default alphabetical sorting since
			 * shouldUseSortFunction returns false.
			 */
			const expected = '{\n\t"apple": 2,\n\t"banana": 3,\n\t"zebra": 1\n}';

			expect(result).toBe(expected);
		});

		it("should handle objects with special key names", () => {
			const result = prettyJsonStringify({
				'key"with"quotes': 3,
				"key\nwith\nnewlines": 2,
				"key with spaces": 1,
			});
			const expected =
				'{\n\t"key\\u000awith\\u000anewlines": 2,\n\t"key with spaces": 1,\n\t"key\\u0022with\\u0022quotes": 3\n}';

			expect(result).toBe(expected);
		});

		it("should handle complex nested structure", () => {
			const complexObject = {
				metadata: {
					created: null,
					version: "1.0.0",
				},
				users: [
					{
						id: 1,
						profile: {
							name: "John Doe",
							settings: {
								notifications: true,
								theme: "dark",
							},
						},
						tags: ["admin", "developer"],
					},
				],
			};

			const result = prettyJsonStringify(complexObject);

			/** Verify it's valid and can be parsed back. */
			const parsed = JSON.parse(result);

			expect(parsed.users[0].profile.name).toBe("John Doe");
			expect(parsed.users[0].tags).toEqual(["admin", "developer"]);
			expect(parsed.metadata.created).toBe(null);
		});

		it("should maintain precision for edge case numbers", () => {
			const numbers = [Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, 1e-10, 1e10, Math.PI];

			for (const number_ of numbers) {
				const result = prettyJsonStringify(number_);

				expect(Number(result)).toBe(number_);
			}
		});

		it("should handle arrays with different data types", () => {
			const result = prettyJsonStringify([1, "hello", true, null, { key: "value" }]);
			const expected = '[\n\t1,\n\t"hello",\n\ttrue,\n\tnull,\n\t{\n\t\t"key": "value"\n\t}\n]';

			expect(result).toBe(expected);
		});
	});

	describe("makeJsonSafe", () => {
		it("should remove any trailing commas", () => {
			const jsonString = `{
	"hello": "world",
}`;

			expect(() => JSON.parse(jsonString)).toThrow();
			expect(() => JSON.parse(makeJsonSafe(jsonString))).not.toThrow();
		});

		it("should remove any line comments", () => {
			const jsonString = `{
	// This is a comment
	"hello": "world"
}`;

			expect(() => JSON.parse(jsonString)).toThrow();
			expect(() => JSON.parse(makeJsonSafe(jsonString))).not.toThrow();
		});

		it("should remove any block comments", () => {
			const jsonString = `{
	/*
	 * This is a comment
	 */
	"hello": "world"
}`;

			expect(() => JSON.parse(jsonString)).toThrow();
			expect(() => JSON.parse(makeJsonSafe(jsonString))).not.toThrow();
		});

		it("should remove all of the above", () => {
			const jsonString = `{
	/*
	 * This is a comment
	 */
	// This is also a comment
	"hello": "world",
}`;

			expect(() => JSON.parse(jsonString)).toThrow();
			expect(() => JSON.parse(makeJsonSafe(jsonString))).not.toThrow();
		});

		it("should preserve URLs with // in string values", () => {
			const jsonString = `{
	"website": "https://example.com",
	"api": "http://api.example.com/data",
	"secure": "https://secure.example.com/path/to/resource"
}`;

			const result = makeJsonSafe(jsonString);
			const parsed = JSON.parse(result);

			expect(parsed.website).toBe("https://example.com");
			expect(parsed.api).toBe("http://api.example.com/data");
			expect(parsed.secure).toBe("https://secure.example.com/path/to/resource");
		});

		it("should preserve URLs while removing comments", () => {
			const jsonString = `{
	// Website configuration
	"website": "https://example.com",
	/* API endpoints */
	"api": "http://api.example.com/data", // Main API
	"backup": "https://backup.example.com/api",
}`;

			expect(() => JSON.parse(jsonString)).toThrow();

			const result = makeJsonSafe(jsonString);

			expect(() => JSON.parse(result)).not.toThrow();

			const parsed = JSON.parse(result);

			expect(parsed.website).toBe("https://example.com");
			expect(parsed.api).toBe("http://api.example.com/data");
			expect(parsed.backup).toBe("https://backup.example.com/api");
		});

		it("should handle complex URLs with query parameters and fragments", () => {
			const jsonString = `{
	"complex_url": "https://example.com/path?param=value&other=test#fragment",
	"ftp_url": "ftp://files.example.com/path/to/file.txt",
	"protocol_relative": "//cdn.example.com/assets/script.js"
}`;

			const result = makeJsonSafe(jsonString);
			const parsed = JSON.parse(result);

			expect(parsed.complex_url).toBe("https://example.com/path?param=value&other=test#fragment");
			expect(parsed.ftp_url).toBe("ftp://files.example.com/path/to/file.txt");
			expect(parsed.protocol_relative).toBe("//cdn.example.com/assets/script.js");
		});

		it("should distinguish between URLs and actual line comments", () => {
			const jsonString = `{
	"url": "https://example.com/path",
	// This is an actual comment that should be removed
	"another_url": "http://test.com//double/slash/path",
		// Another comment
	"data": "value"
}`;

			const result = makeJsonSafe(jsonString);
			const parsed = JSON.parse(result);

			expect(parsed.url).toBe("https://example.com/path");
			expect(parsed.another_url).toBe("http://test.com//double/slash/path");
			expect(parsed.data).toBe("value");

			// Verify comments were removed (result shouldn't contain comment text)
			expect(result).not.toContain("This is an actual comment");
			expect(result).not.toContain("Another comment");
		});
	});
});
