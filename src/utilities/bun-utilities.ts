/**
 * Checks if a given value is a Bun.BunFile instance.
 *
 * @param file - The value to check.
 * @returns `true` if the value is a Bun.BunFile, `false` otherwise.
 */
export function isBunFile(file: unknown): file is Bun.BunFile {
	return file instanceof Blob && "name" in file && typeof file.name === "string" && file.name.length > 0;
}

/**
 * Checks if a given value is a Bun.PathLike type. A PathLike can be a string,
 * URL, ArrayBuffer, or a TypedArray (excluding DataView).
 *
 * @param value - The value to check.
 * @returns `true` if the value is a Bun.PathLike, `false` otherwise.
 */
export function isPathLike(value: unknown): value is Bun.PathLike {
	if (typeof value === "string") return true;
	if (value instanceof URL) return true;
	if (value instanceof ArrayBuffer) return true;
	return !!(ArrayBuffer.isView(value) && !(value instanceof DataView));
}
