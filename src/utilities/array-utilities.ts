/**
 * Defines a function for testing equality between two values of type `T`.
 *
 * This type is used to provide custom comparison logic for array utilities that
 * need to determine if two elements are considered equal.
 *
 * @template T - The type of elements being compared.
 * @param a - The first value to compare.
 * @param b - The second value to compare.
 * @returns `true` if the values are considered equal, otherwise `false`.
 */
export type IsEqual<T> = (a: T, b: T) => boolean;

/**
 * Returns a new array with duplicate elements removed.
 *
 * - If no `isEqual` function is provided, this uses a native `Set` for O(n)
 *   performance (best for primitives or objects by reference).
 * - If a custom `isEqual` function is provided, it uses O(n²) logic to allow
 *   arbitrary equality semantics.
 *
 * @example
 *
 * ```typescript
 * unique([1, 2, 2, 3]); // [1, 2, 3]
 * unique([{ id: 1 }, { id: 1 }], (a, b) => a.id === b.id); // [{ id: 1 }]
 * ```
 *
 * @template T - The type of elements in the array.
 * @param array - The array to filter for unique elements.
 * @param isEqual - Optional custom equality function. If omitted, uses strict
 *   equality (`===`).
 * @returns A new array containing only the first occurrence of each unique
 *   element.
 */
export function unique<T>(array: ReadonlyArray<T>, isEqual?: IsEqual<T>): Array<T> {
	// Fast path: no custom comparator → use native Set
	if (!isEqual) return Array.from(new Set(array));

	const result = new Array<T>();
	let length = 0;
	for (const item of array) if (!result.some((existing) => isEqual(existing, item))) result[length++] = item;
	return result;
}

/**
 * Returns a new array with duplicates removed, using a key extractor function.
 *
 * This function guarantees O(n) performance by using a `Set` to track seen
 * keys.
 *
 * @example
 *
 * ```typescript
 * uniqueBy(users, (user) => user.id);
 * ```
 *
 * @template T - The type of elements in the array.
 * @param array - The array to filter for unique elements.
 * @param keyFunction - A function that extracts a unique key from each element.
 * @returns A new array with unique elements based on the extracted key.
 */
export function uniqueBy<T>(array: ReadonlyArray<T>, keyFunction: (item: T) => unknown): Array<T> {
	const seen = new Set<unknown>();
	const result = new Array<T>();
	let length = 0;

	for (const value of array) {
		const key = keyFunction(value);
		if (!seen.has(key)) {
			seen.add(key);
			result[length++] = value;
		}
	}

	return result;
}

/**
 * Options for customizing uniqueness logic in `makeUnique`.
 *
 * @template T - The type of elements in the array.
 */
export interface UniqueOptions<T> {
	/**
	 * Optional function to extract a unique key from each element. If provided,
	 * `makeUnique` will use `uniqueBy`.
	 */
	readonly byKey?: (item: T) => unknown;

	/**
	 * Optional custom equality function for comparing elements. Used only if
	 * `byKey` is not provided.
	 */
	readonly isEqual?: IsEqual<T>;
}
/**
 * Returns a new array with unique elements, using either a key extractor or a
 * custom equality function.
 *
 * This is a convenience wrapper: if you provide a `byKey` function, it uses
 * `uniqueBy` for O(n) uniqueness by key. Otherwise, it falls back to `unique`
 * with an optional custom equality comparator.
 *
 * @example
 *
 * ```typescript
 * makeUnique([1, 2, 2, 3]); // [1, 2, 3]
 * makeUnique(users, { byKey: (u) => u.id });
 * makeUnique(users, { isEqual: (a, b) => a.name === b.name });
 * ```
 *
 * @template T - The type of elements in the array.
 * @param array - The array to filter for unique elements.
 * @param options - Options for uniqueness: either a key extractor (`byKey`) or
 *   an equality function (`isEqual`).
 * @returns A new array with unique elements.
 */
export function makeUnique<T>(array: ReadonlyArray<T>, options?: UniqueOptions<T>): Array<T> {
	if (options?.byKey) return uniqueBy(array, options.byKey);
	return unique(array, options?.isEqual);
}
