import { addQuoted, escapeString, getSignificantDigits } from "./string-utilities";

export const enum StringEscapeType {
	EscapeFunction = 0,
	None = 1,
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

const JSON_BLOCK_COMMENT_REGEX = /\/\*[\s\S]*?\*\//g;
const JSON_LINE_COMMENT_REGEX = /\/\/[^\r\n]*/g;
const JSON_TRAILING_COMMA_REGEX = /,\s*([}\]])/g;

export function makeJsonSafe(jsonString: string): string {
	return jsonString
		.replace(JSON_BLOCK_COMMENT_REGEX, "")
		.replace(JSON_LINE_COMMENT_REGEX, "")
		.replace(JSON_TRAILING_COMMA_REGEX, "$1");
}
