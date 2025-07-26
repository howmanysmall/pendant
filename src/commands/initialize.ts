import { defineCommand, option } from "@bunli/core";

import chalk from "chalk";
import addToGitIgnoreAsync from "functions/add-to-gitignore-async";
import generateSchemaAsync from "functions/generate-schema-async";
import smartInitializeAsync from "functions/smart-initialize-async";
import { createNamespaceLogger } from "logging/logger-utilities";
import { z } from "zod/v4-mini";

const _logger = createNamespaceLogger("initialize");

// what the initialize command does:
// 1. Generate schema file.
// 2. Add files to gitignore.
// 3. Generate base configuration file.

export const initializeCommand = defineCommand({
	name: "initialize",
	description: "Initializes the pendant environment by generating necessary files.",
	handler: async ({ flags }) => {
		const { codebaseRoot, outputFileName, path, projectFile, target, verbose } = flags;

		await generateSchemaAsync(target, path, verbose);
		await addToGitIgnoreAsync(process.cwd(), outputFileName, verbose);
		await smartInitializeAsync({ codebaseRoot, outputFileName, projectFile, verbose });
	},
	options: {
		codebaseRoot: option(z.string(), {
			description: `The root directory of the codebase to initialize. Will be something like ${chalk.bold.blue("src")}.`,
			short: "c",
		}),
		outputFileName: option(z._default(z.string(), "problematic"), {
			description: "The name of the output file.",
			short: "o",
		}),
		path: option(
			z._default(z.string().check(z.regex(/\.schema\.json$/)), ".schemas/pendant-configuration.schema.json"),
			{
				description: "The path for the schema file.",
				short: "p",
			},
		),
		projectFile: option(z._default(z.string().check(z.regex(/\.project\.json$/)), "default.project.json"), {
			description: "The Rojo project file to use for initialization.",
			short: "R",
		}),
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
