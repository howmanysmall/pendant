import { defineCommand, option } from "@bunli/core";

import generateSchemaAsync from "functions/generate-schema-async";
import { createNamespaceLogger } from "logging/logger-utilities";
import { z } from "zod/v4-mini";

const logger = createNamespaceLogger("initialize");

// what the initialize command does:
// 1. Generate schema file
// 2. Generate base configuration file

export const initializeCommand = defineCommand({
	name: "initialize",
	description: "Initializes the pendant environment by generating necessary files.",
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

export default initializeCommand;
