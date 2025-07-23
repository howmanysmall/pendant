import type { $ZodShape, SomeType } from "zod/v4/core";
import { z } from "zod/v4-mini";

/**
 * Represents a Zod schema for a readonly array.
 *
 * @template T - The type of the elements in the array.
 */
export type Zod_ReadonlyArray<T extends SomeType> = z.ZodMiniReadonly<z.ZodMiniArray<T>>;

/**
 * Creates a Zod schema for a readonly array.
 *
 * @example
 *
 * ```typescript
 * const MyReadonlyArraySchema = readonlyArray(z.string());
 * type MyReadonlyArray = z.infer<typeof MyReadonlyArraySchema>; // ReadonlyArray<string>
 * ```
 *
 * @template T - The type of the elements in the array.
 * @param schema - The Zod schema for the array elements.
 * @returns A Zod schema for a readonly array.
 */
export function readonlyArray<T extends SomeType>(schema: T): Zod_ReadonlyArray<T> {
	return z.readonly(z.array(schema));
}

/**
 * Represents a Zod schema for a strict readonly object.
 *
 * @template Shape - The TypeScript type representing the shape of the object
 *   schema.
 */
export type Zod_StrictReadonlyObject<Shape extends $ZodShape = $ZodShape> = z.ZodMiniReadonly<
	z.ZodMiniObject<Shape, z.core.$strict>
>;

/**
 * Creates a Zod schema for a strict readonly object. A strict object will strip
 * out any properties that are not defined in the schema.
 *
 * @example
 *
 * ```typescript
 * const MyStrictReadonlyObjectSchema = strictReadonlyObject({
 * 	name: z.string(),
 * 	age: z.number(),
 * });
 * type MyStrictReadonlyObject = z.infer<
 * 	typeof MyStrictReadonlyObjectSchema
 * >; // Readonly<{ name: string; age: number; }>
 * ```
 *
 * @template Shape - The TypeScript type representing the shape of the object
 *   schema.
 * @param schema - The Zod shape of the object.
 * @returns A Zod schema for a strict readonly object.
 */
export function strictReadonlyObject<Shape extends $ZodShape = $ZodShape>(
	schema: Shape,
): Zod_StrictReadonlyObject<Shape> {
	return z.readonly(z.strictObject(schema));
}

/**
 * Represents a Zod schema for a readonly object.
 *
 * @template Shape - The TypeScript type representing the shape of the object
 *   schema.
 */
export type Zod_ReadonlyObject<Shape extends $ZodShape = $ZodShape> = z.ZodMiniReadonly<z.ZodMiniObject<Shape>>;

/**
 * Creates a Zod schema for a readonly object.
 *
 * @example
 *
 * ```typescript
 * const MyReadonlyObjectSchema = readonlyObject({
 * 	id: z.string(),
 * 	value: z.boolean(),
 * });
 * type MyReadonlyObject = z.infer<typeof MyReadonlyObjectSchema>; // Readonly<{ id: string; value: boolean; }>
 * ```
 *
 * @template Shape - The TypeScript type representing the shape of the object
 *   schema.
 * @param schema - The Zod shape of the object.
 * @returns A Zod schema for a readonly object.
 */
export function readonlyObject<Shape extends $ZodShape = $ZodShape>(schema: Shape): Zod_ReadonlyObject<Shape> {
	return z.readonly(z.object(schema));
}
