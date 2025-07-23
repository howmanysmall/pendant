import { defineCommand, option } from "@bunli/core";

import { createNamespaceLogger } from "logging/logger-utilities";
import { isPendantConfiguration } from "utilities/configuration-utilities";
import prettyJsonStringify from "utilities/pretty-json-stringify";
import { z } from "zod/v4-mini";

const logger = createNamespaceLogger("generate-schema");

export const generateSchemaCommand = defineCommand({
	name: "generate-schema",
	description: "Creates a schema for the pendant configuration.",
	handler: async ({ flags }) => {
		const { path, target, verbose } = flags;

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
	},
	options: {
		path: option(
			z._default(z.string().check(z.regex(/\.schema\.json$/)), ".schemas/pendant-configuration.schema.json"),
			{
				description: "The path for the schema file.",
				short: "p",
			},
		),
		target: option(z._default(z.union([z.literal("draft-2020-12"), z.literal("draft-7")]), "draft-7"), {
			description: "The JSON Schema version to target.",
			short: "t",
		}),
		verbose: option(z._default(z.boolean(), false), {
			description: "Outputs more information.",
			short: "V",
		}),
	},
});

export default generateSchemaCommand;
