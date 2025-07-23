/**
 * Defines the supported configuration file types for the Pendant tool.
 *
 * These types are used to determine how configuration files are parsed and
 * interpreted.
 */
export const enum ConfigurationFileType {
	/** Represents an INI configuration file. */
	Ini = 0,
	/** Represents a JSON configuration file. */
	Json = 1,
	/** Represents a JSON5 configuration file. */
	Json5 = 2,
	/** Represents a JSONC (JSON with Comments) configuration file. */
	JsonC = 3,
	/** Represents a TOML configuration file. */
	Toml = 4,
	/** Represents a YAML configuration file. */
	Yaml = 5,
}

export default ConfigurationFileType;
