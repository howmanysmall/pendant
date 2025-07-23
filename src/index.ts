#!/usr/bin/env bun

import { createCLI } from "@bunli/core";

import analyzeCommand from "commands/analyze";
import cleanLogsCommand from "commands/clean-logs";
import generateSchemaCommand from "commands/generate-schema";
import { description, name, version } from "constants/package-constants";

const cli = createCLI({ name, description, version });
cli.command(analyzeCommand);
cli.command(cleanLogsCommand);
cli.command(generateSchemaCommand);

await cli.run();
