import { createNamespaceLogger } from "logging/logger-utilities";
import { join } from "node:path";
import { isPendantConfiguration } from "utilities/configuration-utilities";
import { prettyJsonStringify } from "utilities/json-utilities";
import { z } from "zod/mini";

const logger = createNamespaceLogger("generate-schema-async");

/**
 * Generates a JSON Schema for the Pendant configuration and writes it to disk.
 *
 * @example
 *
 * ```typescript
 * await generateSchemaAsync("draft-7", "./schema.json", true);
 * ```
 *
 * @param target - The JSON Schema draft version to use (default: "draft-7").
 * @param path - The output file path (default:
 *   ".schemas/pendant-configuration.schema.json").
 * @param verbose - If true, logs the generated schema to the logger.
 * @returns A promise that resolves when the schema has been written.
 */
export default async function generateSchemaAsync(
	target: "draft-7" | "draft-2020-12" = "draft-7",
	path = join(".schemas", "pendant-configuration.schema.json"),
	verbose = false,
): Promise<void> {
	const schema = z.toJSONSchema(isPendantConfiguration, {
		cycles: "throw",
		io: "output",
		target,
		unrepresentable: "throw",
	});

	const jsonSchema = prettyJsonStringify(
		{
			...schema,
			patternProperties: {
				"^\\$schema$": {
					description: "JSON Schema meta-schema URI (editor hint)",
					format: "any",
					type: "string",
				},
			},
		},
		{
			indent: "\t",
			indentLevel: 0,
		},
	);

	if (verbose) logger.info(`Generated JSON Schema:\n${jsonSchema}`);
	await Bun.write(path, jsonSchema);
}
