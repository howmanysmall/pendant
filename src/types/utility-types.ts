/**
 * Removes all `readonly` modifiers from the properties of a type.
 *
 * This utility type is useful when you need a mutable version of an object type
 * that was previously marked as `readonly`. It recursively removes `readonly`
 * from all top-level properties, but does not affect nested objects.
 *
 * @example
 *
 * ```typescript
 * type ReadonlyUser = { readonly id: string; readonly name: string };
 * type MutableUser = Writable<ReadonlyUser>; // { id: string; name: string }
 * ```
 *
 * @template T - The object type to make writable.
 * @see DeepReadonly
 */
export type Writable<T> = { -readonly [P in keyof T]: T[P] };

/**
 * Recursively marks all properties of a type as `readonly`, including nested
 * objects and arrays.
 *
 * This utility type is useful for enforcing deep immutability in complex data
 * structures. Arrays are converted to `ReadonlyArray` and their elements are
 * also deeply readonly.
 *
 * @example
 *
 * ```typescript
 * type User = { id: string; tags: string[] };
 * type ImmutableUser = DeepReadonly<User>;
 * // { readonly id: string; readonly tags: ReadonlyArray<readonly string> }
 * ```
 *
 * @template T - The object type to make deeply readonly.
 * @see Writable
 */
export type DeepReadonly<T> = {
	readonly [P in keyof T]: T[P] extends Array<infer U> ? ReadonlyArray<DeepReadonly<U>> : DeepReadonly<T[P]>;
};

/**
 * Represents a successful result of an operation.
 *
 * This interface is used as part of the {@link SimpleResult} type to indicate
 * that an operation completed successfully and produced a value. The `success`
 * property is always `true` and the `value` property contains the result.
 *
 * @example
 *
 * ```typescript
 * const result: SuccessResult<number> = { success: true, value: 42 };
 * ```
 *
 * @template T - The type of the value returned on success.
 * @see ErrorResult
 * @see SimpleResult
 */
export interface SuccessResult<T> {
	/** Indicates the operation was successful. Always `true`. */
	readonly success: true;
	/** The value produced by the successful operation. */
	readonly value: T;
}

/**
 * Represents a failed result of an operation.
 *
 * This interface is used as part of the {@link SimpleResult} type to indicate
 * that an operation failed and produced an error. The `success` property is
 * always `false` and the `error` property contains the error information.
 *
 * @example
 *
 * ```typescript
 * const result: ErrorResult<string> = {
 * 	success: false,
 * 	error: "Something went wrong",
 * };
 * ```
 *
 * @template E - The type of the error value.
 * @see SuccessResult
 * @see SimpleResult
 */
export interface ErrorResult<E> {
	/** The error produced by the failed operation. */
	readonly error: E;
	/** Indicates the operation failed. Always `false`. */
	readonly success: false;
}

/**
 * A discriminated union representing the result of an operation that can either
 * succeed or fail.
 *
 * This type is commonly used for error handling in functions and APIs,
 * providing a clear and type-safe way to represent both success and error
 * outcomes. Use a type guard on the `success` property to distinguish between
 * the two cases.
 *
 * @example
 *
 * ```typescript
 * function parseNumber(input: string): SimpleResult<number, string> {
 * 	const value = Number(input);
 * 	if (isNaN(value)) return { success: false, error: "Invalid number" };
 * 	return { success: true, value };
 * }
 *
 * const result = parseNumber("42");
 * if (result.success) {
 * 	console.log("Parsed value:", result.value);
 * } else {
 * 	console.error("Parse error:", result.error);
 * }
 * ```
 *
 * @template T - The type of the value returned on success.
 * @template E - The type of the error value.
 * @see SuccessResult
 * @see ErrorResult
 */
export type SimpleResult<T, E> = ErrorResult<E> | SuccessResult<T>;
