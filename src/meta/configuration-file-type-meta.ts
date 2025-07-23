import { parseINI, parseJSON5, parseJSONC, parseTOML, parseYAML } from "confbox";

import ConfigurationFileType from "./configuration-file-type";

export interface Metadata {
	readonly fileExtensions: ReadonlySet<string>;
	// eslint-disable-next-line ts/no-unnecessary-type-parameters -- it is??
	readonly parse: <T = unknown>(source: string) => T;
}

export const ConfigurationFileTypeMeta: Readonly<Record<ConfigurationFileType, Metadata>> = {
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
		readonly [ConfigurationFileType, Metadata]
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
