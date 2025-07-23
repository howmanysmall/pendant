/**
 * Pretty JSON encoder with configurable indentation and sorting options. Pure
 * TypeScript implementation with no external dependencies.
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

function formatByte(character: string): string {
	return `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`;
}
function escapeString(value: string): string {
	let result = "";
	for (const character of value) {
		const code = character.charCodeAt(0);
		result += code <= 0x1f || character === "\\" || character === '"' ? formatByte(character) : character;
	}
	return result;
}
function getSignificantDigits(number: number): string {
	const asString = number.toString();
	if (Number(asString) === number) return asString;

	for (let precision = 15; precision <= 99; precision += 1) {
		const formatted = number.toPrecision(precision);
		if (Number(formatted) === number) return formatted;
	}

	throw new Error(`Couldn't reproduce accurate number for ${number}.`);
}

/**
 * Pretty-encodes a JSON-serializable value with configurable indentation and
 * sorting.
 *
 * @param object - The value to encode as JSON.
 * @param options - Configuration options for formatting.
 * @returns The pretty-formatted JSON string.
 */
// eslint-disable-next-line max-lines-per-function -- useless
export default function prettyJsonEncodeOld(
	object: unknown,
	{ indent = "\t", indentLevel = 0, shouldUseSortFunction, sortKeys }: Options = {},
): string {
	const padding = indent.repeat(indentLevel);
	const padded = `${padding}${indent}`;
	if (object === null || object === undefined) return "null";

	const typeOf = typeof object;

	if (typeOf === "object") {
		const nextOptions: Options = {
			indent,
			indentLevel: indentLevel + 1,
			shouldUseSortFunction,
			sortKeys,
		};

		if (Array.isArray(object)) {
			if (object.length === 0) return "[]";
			if (object.length === 1) return `[${prettyJsonEncodeOld(object[0], nextOptions)}]`;

			const elements = new Array<string>();
			for (const item of object) elements.push(prettyJsonEncodeOld(item, nextOptions));

			const joinedElements = elements.join(`,\n${padded}`);
			return `[\n${padded}${joinedElements}\n${padding}]`;
		}

		const cast = object as Record<string, unknown>;
		const keys = Object.keys(cast);
		if (keys.length === 0) return "{}";

		// Sort keys based on options
		if (shouldUseSortFunction?.(cast) && sortKeys) keys.sort(sortKeys);
		else keys.sort();

		const properties = new Array<string>();
		for (const key of keys) {
			const value = cast[key];
			const encodedValue = prettyJsonEncodeOld(value, nextOptions);
			properties.push(`${padded}"${escapeString(key)}": ${encodedValue}`);
		}

		return `{\n${properties.join(",\n")}\n${padding}}`;
	}

	if (typeOf === "string") return `"${escapeString(object as string)}"`;
	if (typeOf === "number") return getSignificantDigits(object as number);
	if (typeOf === "boolean") return String(object);

	return "null";
}
