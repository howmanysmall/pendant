import { createNamespaceLogger } from "logging/logger-utilities";
import { isPendantConfiguration } from "utilities/configuration-utilities";
import { prettyJsonStringify } from "utilities/json-utilities";
import { z } from "zod/mini";

const logger = createNamespaceLogger("generate-schema-async");

export default async function generateSchemaAsync(
	target: "draft-7" | "draft-2020-12" = "draft-7",
	path = ".schemas/pendant-configuration.schema.json",
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
