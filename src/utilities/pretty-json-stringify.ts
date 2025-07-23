/**
 * Pretty JSON encoder with configurable indentation and sorting options.
 *
 * Pure TypeScript implementation with no external dependencies, optimized for
 * performance with minimal memory allocations and efficient string operations.
 */

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
}

const HEX_DIGITS = "0123456789abcdef";
function formatByte(character: string): string {
	const code = character.charCodeAt(0);
	return `\\u${HEX_DIGITS[code >>> 12]}${HEX_DIGITS[(code >>> 8) & 0xf]}${HEX_DIGITS[(code >>> 4) & 0xf]}${HEX_DIGITS[code & 0xf]}`;
}
function escapeString(value: string): string {
	let result = "";
	for (let index = 0; index < value.length; index += 1) {
		const character = value[index];
		if (character === undefined) continue;
		const code = character.charCodeAt(0);

		// Handle control characters and quotes
		if (code <= 0x1f || character === '"') {
			result += formatByte(character);
		} else if (character === "\\") {
			// Check if this is already a valid escape sequence
			const nextCharacter = value[index + 1];
			if (nextCharacter && '"\\bfnrt'.includes(nextCharacter)) {
				// This is a simple JSON escape sequence, preserve both characters
				result += character + nextCharacter;
				index++; // Skip the next character since we already processed it
			} else if (nextCharacter === "u" && index + 5 < value.length) {
				// Check for unicode escape sequence \uXXXX
				const unicodeSequence = value.slice(index + 2, index + 6);
				if (/^[0-9a-fA-F]{4}$/.test(unicodeSequence)) {
					// Valid unicode escape, preserve the entire sequence
					result += value.slice(index, index + 6);
					index += 5; // Skip the next 5 characters
				} else {
					// Invalid unicode escape, escape the backslash
					result += formatByte(character);
				}
			} else {
				// This is a standalone backslash, escape it
				result += formatByte(character);
			}
		} else {
			result += character;
		}
	}
	return result;
}
function getSignificantDigits(number: number): string {
	const asString = number.toString();
	if (Number(asString) === number) return asString;

	let minimumPrecision = 15;
	let maximumPrecision = 99;

	while (minimumPrecision <= maximumPrecision) {
		const precision = Math.floor((minimumPrecision + maximumPrecision) / 2);
		const formatted = number.toPrecision(precision);
		const parsed = Number(formatted);

		if (parsed === number) {
			// eslint-disable-next-line sonar/no-dead-store -- not useless?
			maximumPrecision = precision - 1;

			let finalPrecision = precision;
			for (let index = minimumPrecision; index <= precision; index += 1) {
				const testFormatted = number.toPrecision(index);
				if (Number(testFormatted) === number) {
					finalPrecision = index;
					break;
				}
			}
			return number.toPrecision(finalPrecision);
		}

		minimumPrecision = precision + 1;
	}

	throw new Error(`Couldn't reproduce accurate number for ${number}.`);
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
export default function prettyJsonStringify(
	object: unknown,
	{ indent = "\t", indentLevel = 0, shouldUseSortFunction, sortKeys }: Options = {},
): string {
	if (object === null || object === undefined) return "null";

	const typeOf = typeof object;

	if (typeOf === "string") return `"${escapeString(object as string)}"`;
	if (typeOf === "number") return getSignificantDigits(object as number);
	if (typeOf === "boolean") return String(object);

	if (typeOf === "object") {
		const padding = indent.repeat(indentLevel);
		const padded = padding + indent;

		const nextOptions: Options = {
			indent,
			indentLevel: indentLevel + 1,
			shouldUseSortFunction,
			sortKeys,
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
