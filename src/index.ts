import { createCLI } from "@bunli/core";

import analyzeCommand from "commands/analyze";
import cleanLogsCommand from "commands/clean-logs";
import generateSchemaCommand from "commands/generate-schema";
import initializeCommand from "commands/initialize";
import { description, name, version } from "constants/package-constants";

// Optimize startup by pre-allocating CLI with known commands
const cli = createCLI({ name, description, version });

// Register commands in order of expected usage frequency
cli.command(analyzeCommand);
cli.command(initializeCommand);
cli.command(generateSchemaCommand);
cli.command(cleanLogsCommand);

// Check if this is the main module to allow for testing
if (import.meta.main) await cli.run();
