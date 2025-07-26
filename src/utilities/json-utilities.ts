import { addQuoted, escapeString, getSignificantDigits } from "./string-utilities";

/**
 * Enumerates string escaping strategies for JSON encoding.
 *
 * @remarks
 * Used by {@linkcode prettyJsonStringify} and related utilities to control how
 * strings are escaped.
 */
export const enum StringEscapeType {
	/** Use the escapeString function for escaping. */
	EscapeFunction = 0,
	/** Do not escape strings. */
	None = 1,
	/** Add quotes and escape special characters. */
	Quoted = 2,
}

/** Options for customizing the JSON encoding behavior. */
export interface Options {
	/** The string to use for indentation (defaults to "\t"). */
	readonly indent?: string;
	/** The current indentation level (defaults to 0). */
	readonly indentLevel?: number;
	/** Function to determine if an object should use custom sorting. */
	readonly shouldUseSortFunction?: (object: Record<string, unknown>) => boolean;
	/** Custom sorting function for object keys. */
	readonly sortKeys?: (a: string, b: string) => number;
	/**
	 * Controls how strings are escaped in the output.
	 *
	 * @see StringEscapeType
	 */
	readonly stringEscapeType?: StringEscapeType;
}

type TypeOf = "bigint" | "boolean" | "function" | "number" | "object" | "string" | "symbol" | "undefined";

function isBoolean(object: unknown, typeOf: TypeOf): object is boolean {
	return typeOf === "boolean";
}
function isNumber(object: unknown, typeOf: TypeOf): object is number {
	return typeOf === "number";
}
function isString(object: unknown, typeOf: TypeOf): object is string {
	return typeOf === "string";
}

/**
 * Pretty-encodes a JSON-serializable value with configurable indentation and
 * sorting.
 *
 * This function recursively processes the input value to generate a formatted
 * JSON string with proper indentation and optional key sorting. It handles all
 * standard JSON types including null, undefined, booleans, numbers, strings,
 * arrays, and objects.
 *
 * @example
 *
 * ```typescript
 * const data = { users: [{ name: "Alice", age: 30 }], active: true };
 * const formatted = prettyJsonEncode(data, { indent: "  " });
 * console.log(formatted);
 * // Output:
 * // {
 * //   "active": true,
 * //   "users": [
 * //     {
 * //       "age": 30,
 * //       "name": "Alice"
 * //     }
 * //   ]
 * // }
 * ```
 *
 * @param object - The value to encode as JSON.
 * @param options - Configuration options for formatting.
 * @returns The pretty-formatted JSON string.
 */
export function prettyJsonStringify(
	object: unknown,
	{
		indent = "\t",
		indentLevel = 0,
		shouldUseSortFunction,
		sortKeys,
		stringEscapeType = StringEscapeType.EscapeFunction,
	}: Options = {},
): string {
	if (object === null || object === undefined) return "null";

	const typeOf = typeof object;

	if (isString(object, typeOf)) {
		switch (stringEscapeType) {
			case StringEscapeType.EscapeFunction: {
				return `"${escapeString(object)}"`;
			}

			case StringEscapeType.None: {
				return `"${object}"`;
			}

			case StringEscapeType.Quoted: {
				return addQuoted(object);
			}

			default: {
				throw new Error(`Unknown escape type: ${stringEscapeType}`);
			}
		}
	}

	if (isNumber(object, typeOf)) return getSignificantDigits(object);
	if (isBoolean(object, typeOf)) return String(object);

	if (typeOf === "object") {
		const padding = indent.repeat(indentLevel);
		const padded = padding + indent;

		const nextOptions: Options = {
			indent,
			indentLevel: indentLevel + 1,
			shouldUseSortFunction,
			sortKeys,
			stringEscapeType,
		};

		if (Array.isArray(object)) {
			const { length } = object;
			if (length === 0) return "[]";
			if (length === 1) return `[${prettyJsonStringify(object[0], nextOptions)}]`;

			const elements = new Array<string>(length);
			for (let index = 0; index < length; index += 1)
				elements[index] = prettyJsonStringify(object[index], nextOptions);

			const result = elements.join(`,\n${padded}`);
			return `[\n${padded}${result}\n${padding}]`;
		}

		const cast = object as Record<string, unknown>;
		const keys = Object.keys(cast);
		const keyCount = keys.length;
		if (keyCount === 0) return "{}";

		if (shouldUseSortFunction?.(cast) && sortKeys) keys.sort(sortKeys);
		else keys.sort();

		const properties = new Array<string>(keyCount);
		for (let index = 0; index < keyCount; index += 1) {
			const key = keys[index];
			if (key === undefined) continue;
			const value = cast[key];
			const encodedValue = prettyJsonStringify(value, nextOptions);
			properties[index] = `${padded}"${escapeString(key)}": ${encodedValue}`;
		}

		return `{\n${properties.join(",\n")}\n${padding}}`;
	}

	return "null";
}

// Regex for whitespace checking (defined at module level for performance)
const WHITESPACE_REGEX = /\s/;
function countPrecedingBackslashes(string: string, startIndex: number): number {
	let count = 0;
	let checkIndex = startIndex;

	while (checkIndex >= 0 && string[checkIndex] === "\\") {
		count += 1;
		checkIndex -= 1;
	}

	return count;
}
function processQuotedString(jsonString: string, startIndex: number, result: Array<string>): number {
	const { length } = jsonString;
	let index = startIndex;

	const openingQuote = jsonString[index];
	if (openingQuote !== undefined) result.push(openingQuote);
	index += 1;

	while (index < length) {
		const stringCharacter = jsonString[index];
		if (stringCharacter === undefined) break;

		result.push(stringCharacter);

		if (stringCharacter === '"') {
			const backslashCount = countPrecedingBackslashes(jsonString, index - 1);
			if (backslashCount % 2 === 0) {
				index += 1;
				break;
			}
		}
		index += 1;
	}

	return index;
}

function processTrailingComma(jsonString: string, startIndex: number, length: number, result: Array<string>): number {
	let nextIndex = startIndex + 1;
	while (nextIndex < length) {
		const nextCharacter = jsonString[nextIndex];
		if (nextCharacter === undefined || !WHITESPACE_REGEX.test(nextCharacter)) break;
		nextIndex += 1;
	}

	const nextCharacter = jsonString[nextIndex];
	if (nextCharacter === "}" || nextCharacter === "]") {
		let index = startIndex + 1;
		while (index < nextIndex) {
			const whitespaceCharacter = jsonString[index];
			if (whitespaceCharacter !== undefined) result.push(whitespaceCharacter);
			index += 1;
		}
		return nextIndex;
	}

	return startIndex;
}
function removeTrailingCommas(jsonString: string): string {
	const result = new Array<string>();
	let index = 0;
	const { length } = jsonString;

	while (index < length) {
		const character = jsonString[index];
		if (character === undefined) break;

		if (character === '"') {
			const stringEndIndex = processQuotedString(jsonString, index, result);
			index = stringEndIndex;
			continue;
		}

		if (character === ",") {
			const nextIndex = processTrailingComma(jsonString, index, length, result);
			if (nextIndex !== index) {
				index = nextIndex;
				continue;
			}
		}

		result.push(character);
		index += 1;
	}

	return result.join("");
}

function removeCommentsOnly(jsonString: string): string {
	const result = new Array<string>();
	let index = 0;
	const { length } = jsonString;

	while (index < length) {
		const character = jsonString[index];
		if (character === undefined) break;

		if (character === '"') {
			const stringEndIndex = processQuotedString(jsonString, index, result);
			index = stringEndIndex;
			continue;
		}

		if (character === "/" && index + 1 < length && jsonString[index + 1] === "*") {
			index += 2;
			while (index + 1 < length) {
				if (jsonString[index] === "*" && jsonString[index + 1] === "/") {
					index += 2;
					break;
				}
				index += 1;
			}
			continue;
		}

		if (character === "/" && index + 1 < length && jsonString[index + 1] === "/") {
			index += 2;
			while (index < length && jsonString[index] !== "\n" && jsonString[index] !== "\r") index += 1;
			continue;
		}

		result.push(character);
		index += 1;
	}

	return result.join("");
}

/**
 * Safely removes JSON comments and trailing commas while preserving string
 * content.
 *
 * This function properly parses JSON structure to avoid corrupting string
 * values that may contain comment-like or comma-like patterns.
 *
 * @param jsonString - The JSON string to clean up.
 * @returns The cleaned JSON string.
 * @throws {Error} If the input contains malformed JSON structure.
 */
export function makeJsonSafe(jsonString: string): string {
	return removeTrailingCommas(removeCommentsOnly(jsonString));
}
