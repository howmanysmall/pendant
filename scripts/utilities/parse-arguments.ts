// argument-parser-high.ts
// Strongly-typed command-line argument parser

export const enum OptionType {
	Boolean = 0,
	Number = 1,
	String = 2,
}

interface OptionSpecificationBase<T extends OptionType> {
	/** Single-character alias (without dash). */
	readonly alias?: string;
	/** Allowed values (for enum-like options). */
	readonly choices?: ReadonlyArray<string>;
	/** Default value if option not provided. */
	readonly default?: OptionTypeMap[T];
	/** Description for help text (optional). */
	readonly description?: string;
	/** The data type of the option's value. */
	readonly type: T;
}

export type OptionSpecification<T extends OptionType = OptionType> = OptionSpecificationBase<T>;

interface OptionTypeMap {
	readonly [OptionType.Boolean]: boolean;
	readonly [OptionType.Number]: number;
	readonly [OptionType.String]: string;
}

/** Schema describing allowed options. */
export type Schema = Record<string, OptionSpecification>;

type TypeFromSpecification<S extends OptionSpecification> = S extends { choices: ReadonlyArray<infer C> }
	? C
	: S extends OptionSpecificationBase<infer T>
		? OptionTypeMap[T]
		: never;

/**
 * Parsed arguments type for a given schema.
 *
 * @template S - Schema defining options.
 */
export type ParsedArguments<S extends Schema> = {
	/** Positional arguments. */
	readonly _: Array<string>;
} & { readonly [K in keyof S]: TypeFromSpecification<S[K]> };

/**
 * Parse command-line arguments according to the given schema.
 *
 * @template S
 * @param schema - Definition of allowed options.
 * @param argumentsList - Arguments array (defaults to Bun.argv.slice(2)).
 * @returns Parsed arguments object with options and positional args.
 */
// eslint-disable-next-line max-lines-per-function -- hate this
export default function parseArguments<S extends Schema>(
	schema: S,
	argumentsList: Array<string> = Bun.argv.slice(2),
): ParsedArguments<S> {
	const result = { _: [] } as ParsedArguments<S>;
	const entries = Object.entries(schema) as Array<[keyof S, S[keyof S]]>;

	for (const [key, specification] of entries)
		if (specification.default !== undefined) result[key] = specification.default as never;
		else if (specification.type === OptionType.Boolean) result[key] = false as never;

	const aliasMap: Record<string, keyof S> = {};
	for (const [key, specification] of entries) if (specification.alias) aliasMap[specification.alias] = key;

	// biome-ignore lint/style/useForOf: no, don't want to because of weird incrementing in loop
	for (let index = 0; index < argumentsList.length; index += 1) {
		const argument = argumentsList[index];
		if (argument === undefined) continue;

		if (argument.startsWith("--")) {
			const key = argument.slice(2) as keyof S;
			const specification = schema[key];
			if (!specification) throw new Error(`Unknown option --${String(key)}`);

			if (specification.type === OptionType.Boolean) result[key] = true as never;
			else {
				const value = argumentsList[++index];
				if (value === undefined) throw new Error(`Expected value after --${String(key)}`);
				const valueOrValue = value;
				if (specification.choices && !specification.choices.includes(valueOrValue)) {
					throw new Error(
						`Invalid value for --${String(key)}: ${valueOrValue}. Allowed: ${specification.choices.join(", ")}`,
					);
				}
				result[key] = (specification.type === OptionType.Number ? Number(valueOrValue) : valueOrValue) as never;
			}
		} else if (argument.startsWith("-") && argument.length > 1) {
			const letters = argument.slice(1);
			for (let jndex = 0; jndex < letters.length; jndex += 1) {
				const alias = letters[jndex];
				if (!alias) continue;

				const key = aliasMap[alias];
				if (!key) throw new Error(`Unknown alias -${alias}`);

				const specification = schema[key];
				if (!specification) throw new Error(`Unknown option -${alias}`);

				if (specification.type === OptionType.Boolean) result[key] = true as never;
				else if (jndex < letters.length - 1) {
					const valueString = letters.slice(jndex + 1);
					const constantValue = valueString;
					if (specification.choices && !specification.choices.includes(constantValue))
						throw new Error(
							`Invalid value for -${alias}: ${constantValue}. Allowed: ${specification.choices.join(", ")}`,
						);

					result[key] = (
						specification.type === OptionType.Number ? Number(constantValue) : constantValue
					) as never;
					break;
				} else {
					const value = argumentsList[++index];
					if (value === undefined) throw new Error(`Expected value after -${alias}`);
					const constantValue = value;
					if (specification.choices && !specification.choices.includes(constantValue))
						throw new Error(
							`Invalid value for -${alias}: ${constantValue}. Allowed: ${specification.choices.join(", ")}`,
						);

					result[key] = (
						specification.type === OptionType.Number ? Number(constantValue) : constantValue
					) as never;
				}
			}
		} else result._.push(argument);
	}

	return result;
}
