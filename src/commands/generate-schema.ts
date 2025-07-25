import { defineCommand, option } from "@bunli/core";

import generateSchemaAsync from "functions/generate-schema-async";
import { z } from "zod/v4-mini";

export const generateSchemaCommand = defineCommand({
	name: "generate-schema",
	description: "Creates a schema for the pendant configuration.",
	handler: async ({ flags }) => {
		const { path, target, verbose } = flags;
		await generateSchemaAsync(target, path, verbose);
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
