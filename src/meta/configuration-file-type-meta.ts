import { parseINI, parseJSON5, parseJSONC, parseTOML, parseYAML } from "confbox";

import ConfigurationFileType from "./configuration-file-type";

/**
 * Describes the metadata for a configuration file type (e.g., JSON, TOML,
 * YAML).
 *
 * @example
 *
 * ```typescript
 * const meta = ConfigurationFileTypeMeta[ConfigurationFileType.Json];
 * meta.parse('{"foo": 1}'); // { foo: 1 }
 * ```
 *
 * @property fileExtensions - Set of file extensions associated with this type.
 * @property parse - Function to parse a string into a value of this type.
 */
export interface ConfigurationFileTypeMetadata {
	/** File extensions associated with this type. */
	readonly fileExtensions: ReadonlySet<string>;
	/** Function to parse a string into a value of this type. */
	// eslint-disable-next-line ts/no-unnecessary-type-parameters -- it is??
	readonly parse: <T = unknown>(source: string) => T;
}

/**
 * Metadata for all supported configuration file types.
 *
 * Maps each {@linkcode ConfigurationFileType} to its metadata, including
 * extensions and parse function.
 *
 * @example
 *
 * ```typescript
 * const jsonMeta = ConfigurationFileTypeMeta[ConfigurationFileType.Json];
 * jsonMeta.fileExtensions.has("json"); // true
 * ```
 */
export const ConfigurationFileTypeMeta: Readonly<Record<ConfigurationFileType, ConfigurationFileTypeMetadata>> = {
	[ConfigurationFileType.Ini]: {
		fileExtensions: new Set(["cfg", "cnf", "conf", "inf", "ini"]),
		parse: (source: string) => parseINI(source, {}),
	},
	[ConfigurationFileType.Json]: {
		fileExtensions: new Set(["json"]),
		parse: (source: string) => JSON.parse(source),
	},
	[ConfigurationFileType.Json5]: {
		fileExtensions: new Set(["json5"]),
		parse: (source: string) => parseJSON5(source, {}),
	},
	[ConfigurationFileType.JsonC]: {
		fileExtensions: new Set(["jsonc"]),
		parse: (source: string) => parseJSONC(source, {}),
	},
	[ConfigurationFileType.Toml]: {
		fileExtensions: new Set(["toml"]),
		parse: parseTOML,
	},
	[ConfigurationFileType.Yaml]: {
		fileExtensions: new Set(["yaml", "yml"]),
		parse: (source: string) => parseYAML(source, {}),
	},
};

// Validate that no file extension is shared between different configuration file types.
{
	const allEntries = Object.entries(ConfigurationFileTypeMeta) as unknown as ReadonlyArray<
		readonly [ConfigurationFileType, ConfigurationFileTypeMetadata]
	>;
	const extensionToFileType = new Map<string, ConfigurationFileType>();

	for (const [configurationFileType, { fileExtensions }] of allEntries)
		for (const extension of fileExtensions) {
			const existingFileType = extensionToFileType.get(extension);
			if (existingFileType !== undefined)
				throw new Error(
					`Duplicate file extension "${extension}" found in both file type ${existingFileType} and ${configurationFileType}.`,
				);

			extensionToFileType.set(extension, configurationFileType);
		}
}

export default ConfigurationFileTypeMeta;
