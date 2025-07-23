import { describe, expect, test } from "bun:test";
import prettyJsonStringify from "utilities/pretty-json-stringify";

describe("prettyJsonEncode", () => {
	test("handles null and undefined values", () => {
		expect(prettyJsonStringify(null)).toBe("null");
		expect(prettyJsonStringify(undefined)).toBe("null");
	});

	test("handles boolean values", () => {
		expect(prettyJsonStringify(true)).toBe("true");
		expect(prettyJsonStringify(false)).toBe("false");
	});

	test("handles string values", () => {
		expect(prettyJsonStringify("hello")).toBe('"hello"');
		expect(prettyJsonStringify("")).toBe('""');
	});

	test("escapes special characters in strings", () => {
		expect(prettyJsonStringify("hello\nworld")).toBe('"hello\\u000aworld"');
		expect(prettyJsonStringify('say "hello"')).toBe('"say \\u0022hello\\u0022"');
		expect(prettyJsonStringify("back\\slash")).toBe('"back\\u005cslash"');
		expect(prettyJsonStringify("\t\r\n")).toBe('"\\u0009\\u000d\\u000a"');
	});

	test("handles number values", () => {
		expect(prettyJsonStringify(42)).toBe("42");
		expect(prettyJsonStringify(0)).toBe("0");
		expect(prettyJsonStringify(-1)).toBe("-1");
		expect(prettyJsonStringify(Math.PI)).toBe(Math.PI.toString());
	});

	test("handles floating point precision", () => {
		const result = prettyJsonStringify(0.1 + 0.2);

		expect(Number(result)).toBe(0.1 + 0.2);
	});

	test("handles empty arrays", () => {
		expect(prettyJsonStringify([])).toBe("[]");
	});

	test("handles simple arrays", () => {
		const result = prettyJsonStringify([1, 2, 3]);
		const expected = "[\n\t1,\n\t2,\n\t3\n]";

		expect(result).toBe(expected);
	});

	test("handles nested arrays", () => {
		const result = prettyJsonStringify([
			[1, 2],
			[3, 4],
		]);
		const expected = "[\n\t[\n\t\t1,\n\t\t2\n\t],\n\t[\n\t\t3,\n\t\t4\n\t]\n]";

		expect(result).toBe(expected);
	});

	test("handles empty objects", () => {
		expect(prettyJsonStringify({})).toBe("{}");
	});

	test("handles simple objects", () => {
		const result = prettyJsonStringify({ a: 1, b: 2 });
		const expected = '{\n\t"a": 1,\n\t"b": 2\n}';

		expect(result).toBe(expected);
	});

	test("handles nested objects", () => {
		const result = prettyJsonStringify({
			active: true,
			user: { name: "John", age: 30 },
		});
		const expected = '{\n\t"active": true,\n\t"user": {\n\t\t"age": 30,\n\t\t"name": "John"\n\t}\n}';

		expect(result).toBe(expected);
	});

	test("handles mixed arrays and objects", () => {
		const result = prettyJsonStringify([
			{ name: "Alice", scores: [85, 92] },
			{ name: "Bob", scores: [78, 88] },
		]);
		const expected =
			'[\n\t{\n\t\t"name": "Alice",\n\t\t"scores": [\n\t\t\t85,\n\t\t\t92\n\t\t]\n\t},\n\t{\n\t\t"name": "Bob",\n\t\t"scores": [\n\t\t\t78,\n\t\t\t88\n\t\t]\n\t}\n]';

		expect(result).toBe(expected);
	});

	test("handles custom indent string", () => {
		const result = prettyJsonStringify({ a: 1, b: [2, 3] }, { indent: "  " });
		const expected = '{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}';

		expect(result).toBe(expected);
	});

	test("handles custom indent level", () => {
		const result = prettyJsonStringify({ a: 1 }, { indentLevel: 2 });
		const expected = '{\n\t\t\t"a": 1\n\t\t}';

		expect(result).toBe(expected);
	});

	test("handles custom sort function", () => {
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

	test("handles sort function that returns false", () => {
		const shouldNotSort = (): boolean => false;
		const customSort = (a: string, b: string): number => b.localeCompare(a);

		const result = prettyJsonStringify(
			{ apple: 2, banana: 3, zebra: 1 },
			{ shouldUseSortFunction: shouldNotSort, sortKeys: customSort },
		);
		/**
		 * Should use default alphabetical sorting since shouldUseSortFunction
		 * returns false.
		 */
		const expected = '{\n\t"apple": 2,\n\t"banana": 3,\n\t"zebra": 1\n}';

		expect(result).toBe(expected);
	});

	test("handles objects with special key names", () => {
		const result = prettyJsonStringify({
			'key"with"quotes': 3,
			"key\nwith\nnewlines": 2,
			"key with spaces": 1,
		});
		const expected =
			'{\n\t"key\\u000awith\\u000anewlines": 2,\n\t"key with spaces": 1,\n\t"key\\u0022with\\u0022quotes": 3\n}';

		expect(result).toBe(expected);
	});

	test("handles complex nested structure", () => {
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

	test("maintains precision for edge case numbers", () => {
		const numbers = [Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, 1e-10, 1e10, Math.PI];

		for (const number_ of numbers) {
			const result = prettyJsonStringify(number_);

			expect(Number(result)).toBe(number_);
		}
	});

	test("handles arrays with different data types", () => {
		const result = prettyJsonStringify([1, "hello", true, null, { key: "value" }]);
		const expected = '[\n\t1,\n\t"hello",\n\ttrue,\n\tnull,\n\t{\n\t\t"key": "value"\n\t}\n]';

		expect(result).toBe(expected);
	});
});
