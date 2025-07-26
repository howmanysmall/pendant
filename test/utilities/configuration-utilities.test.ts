import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rimraf } from "rimraf";
import {
	getFirstConfigurationAsync,
	getPendantConfigurationAsync,
	isPendantConfiguration,
	type PendantConfiguration,
} from "utilities/configuration-utilities";
import { extractConfigurationFilesAsync } from "utilities/extraction-utilities";

const DEFAULT = "default.project.json";
const DOT_PENDANT_JSON = ".pendant.json";
const PENDANT_JSON = "pendant.json";

// Test configuration file contents
const EXPECTED_CLIENT_FILES = ["src/client/**", "src/UIFusion/**"];
const EXPECTED_SERVER_FILES = ["src/server/**"];
const EXPECTED_SHARED_FILES = ["src/shared/**"];
const EXPECTED_TESTING_FILES = ["src/testing/**"];
const EXPECTED_PROBLEMATIC_FILES = ["src/legacy/**", "src/deprecated/**"];
const CORRECTLY_NAMED_DOT_PENDANT = "correctly-named-dot-pendant";
const INVALID_JSON = "{ invalid json }";

function getFirstTest(
	getTemporaryDirectory: () => string,
	callback: typeof getFirstConfigurationAsync,
	name?: string,
): void {
	describe(name ? `getFirstConfigurationAsync (${name})` : "getFirstConfigurationAsync", () => {
		let cleanupAsync: (() => Promise<void>) | undefined;

		afterEach(async () => {
			if (!cleanupAsync) return;
			await cleanupAsync();
			cleanupAsync = undefined;
		});

		it("should find and parse a valid .pendant.json configuration", async () => {
			cleanupAsync = await extractConfigurationFilesAsync(undefined, getTemporaryDirectory());

			const result = await callback(join(getTemporaryDirectory(), CORRECTLY_NAMED_DOT_PENDANT));

			expect(result.files.client).toEqual(EXPECTED_CLIENT_FILES);
			expect(result.files.server).toEqual(EXPECTED_SERVER_FILES);
			expect(result.files.shared).toEqual(EXPECTED_SHARED_FILES);
			expect(result.files.testing).toEqual(EXPECTED_TESTING_FILES);
			expect(result.ignoreGlobs).toEqual(EXPECTED_PROBLEMATIC_FILES);
			expect(result.outputFileName).toBe("problematic");
			expect(result.projectFile).toBe(DEFAULT);
		});

		it("should find pendant.json when .pendant.json doesn't exist", async () => {
			cleanupAsync = await extractConfigurationFilesAsync(undefined, getTemporaryDirectory());

			const result = await callback(join(getTemporaryDirectory(), "correctly-named-pendant"));

			expect(result.files.client).toEqual(EXPECTED_CLIENT_FILES);
			expect(result.files.server).toEqual(EXPECTED_SERVER_FILES);
			expect(result.files.shared).toEqual(EXPECTED_SHARED_FILES);
			expect(result.files.testing).toEqual(EXPECTED_TESTING_FILES);
		});

		it("should prioritize .pendant.json over pendant.json", async () => {
			cleanupAsync = await extractConfigurationFilesAsync(undefined, getTemporaryDirectory());

			// Create a test directory with both files
			const testDirectory = join(getTemporaryDirectory(), "priority-test");
			await mkdir(testDirectory, { recursive: true });
			const pendantConfigPath = join(testDirectory, DOT_PENDANT_JSON);
			const regularConfigPath = join(testDirectory, PENDANT_JSON);

			const priorityConfig = {
				files: {
					client: ["Priority"],
					server: [],
					shared: [],
				},
			};

			const regularConfig = {
				files: {
					client: ["Regular"],
					server: [],
					shared: [],
				},
			};

			await writeFile(pendantConfigPath, JSON.stringify(priorityConfig, null, 2));
			await writeFile(regularConfigPath, JSON.stringify(regularConfig, null, 2));

			const result = await callback(testDirectory);

			expect(result.files.client).toEqual(["Priority"]);
		});

		it("should skip incorrectly named configuration files", async () => {
			cleanupAsync = await extractConfigurationFilesAsync(undefined, getTemporaryDirectory());

			// The incorrectly-named directory has pendant-cli.json which should not be found
			// since pendant-cli is not in the FILE_NAMES array
			expect(callback(join(getTemporaryDirectory(), "incorrectly-named"))).rejects.toThrow(
				"No pendant configuration file found",
			);
		});

		it("should remove $schema property from result", async () => {
			cleanupAsync = await extractConfigurationFilesAsync(undefined, getTemporaryDirectory());

			const result = await callback(join(getTemporaryDirectory(), CORRECTLY_NAMED_DOT_PENDANT));

			expect("$schema" in result).toBe(false);
		});

		it("should skip invalid configuration files and find valid ones", async () => {
			cleanupAsync = await extractConfigurationFilesAsync(undefined, getTemporaryDirectory());

			const testDirectory = join(getTemporaryDirectory(), "mixed-validity");
			await mkdir(testDirectory, { recursive: true });
			const invalidConfigPath = join(testDirectory, DOT_PENDANT_JSON);
			const validConfigPath = join(testDirectory, PENDANT_JSON);

			const invalidConfig = {
				files: {
					// Missing required properties
				},
			};

			const validConfig = {
				files: {
					client: ["Valid"],
					server: [],
					shared: [],
				},
			};

			await writeFile(invalidConfigPath, JSON.stringify(invalidConfig, null, 2));
			await writeFile(validConfigPath, JSON.stringify(validConfig, null, 2));

			const result = await callback(testDirectory);

			expect(result.files.client).toEqual(["Valid"]);
		});

		it("should skip files with invalid JSON and find valid ones", async () => {
			cleanupAsync = await extractConfigurationFilesAsync(undefined, getTemporaryDirectory());

			const testDirectory = join(getTemporaryDirectory(), "mixed-json");
			await mkdir(testDirectory, { recursive: true });
			const invalidJsonPath = join(testDirectory, DOT_PENDANT_JSON);
			const validConfigPath = join(testDirectory, PENDANT_JSON);

			const validConfig = {
				files: {
					client: ["Valid"],
					server: [],
					shared: [],
				},
			};

			await writeFile(invalidJsonPath, INVALID_JSON);
			await writeFile(validConfigPath, JSON.stringify(validConfig, null, 2));

			const result = await callback(testDirectory);

			expect(result.files.client).toEqual(["Valid"]);
		});

		it("should throw error when no valid configuration file is found", async () => {
			cleanupAsync = await extractConfigurationFilesAsync(undefined, getTemporaryDirectory());

			expect(callback(join(getTemporaryDirectory(), "no-configuration"))).rejects.toThrow(
				"No pendant configuration file found",
			);
		});

		it("should throw error when directory doesn't exist", () => {
			const nonExistentDirectory = join(getTemporaryDirectory(), "nonexistent");

			expect(callback(nonExistentDirectory)).rejects.toThrow();
		});

		it("should handle configuration with all optional fields", async () => {
			cleanupAsync = await extractConfigurationFilesAsync(undefined, getTemporaryDirectory());

			const result = await callback(join(getTemporaryDirectory(), CORRECTLY_NAMED_DOT_PENDANT));

			expect(result.files.testing).toEqual(EXPECTED_TESTING_FILES);
			expect(result.ignoreGlobs).toEqual(EXPECTED_PROBLEMATIC_FILES);
			expect(result.outputFileName).toBe("problematic");
			expect(result.projectFile).toBe(DEFAULT);
		});

		it("should work with current working directory when no path provided", async () => {
			const originalCwd = process.cwd();

			try {
				// Extract to a subdirectory of our temp directory
				const testConfigDirectory = join(getTemporaryDirectory(), "cwd-test");
				cleanupAsync = await extractConfigurationFilesAsync(undefined, testConfigDirectory);

				// Change to the correctly-named-dot-pendant directory
				const configDirectory = join(testConfigDirectory, CORRECTLY_NAMED_DOT_PENDANT);
				process.chdir(configDirectory);

				const result = await callback();

				expect(result.files.client).toEqual(EXPECTED_CLIENT_FILES);
				expect(result.files.server).toEqual(EXPECTED_SERVER_FILES);
				expect(result.files.shared).toEqual(EXPECTED_SHARED_FILES);
			} finally {
				process.chdir(originalCwd);
			}
		});

		it("should test file priority order correctly", async () => {
			cleanupAsync = await extractConfigurationFilesAsync(undefined, getTemporaryDirectory());

			const testDirectory = join(getTemporaryDirectory(), "priority-order");
			await mkdir(testDirectory, { recursive: true });

			// Create files in reverse priority order with different content
			const configs = [
				{ client: ["Configuration"], file: "pendant.configuration.json" },
				{ client: ["Config"], file: "pendant.config.json" },
				{ client: ["DashConfig"], file: "pendant-config.json" },
				{ client: ["Pendant"], file: PENDANT_JSON },
				{ client: ["DotPendant"], file: DOT_PENDANT_JSON },
			];

			for (const { client, file } of configs) {
				const configData = {
					files: {
						client,
						server: [],
						shared: [],
					},
				};
				await writeFile(join(testDirectory, file), JSON.stringify(configData, null, 2));
			}

			const result = await callback(testDirectory);

			// Should find .pendant.json first due to priority order
			expect(result.files.client).toEqual(["DotPendant"]);
		});
	});
}

describe("configuration-utilities", () => {
	let temporaryDirectory: string;

	beforeEach(async () => {
		temporaryDirectory = await mkdtemp(join(tmpdir(), "pendant-test-"));
	});

	afterEach(async () => {
		await rimraf(temporaryDirectory);
	});

	describe("isPendantConfiguration", () => {
		it("should validate a valid configuration", () => {
			const validConfiguration = {
				files: {
					client: ["ReplicatedFirst", "StarterPlayer"],
					server: ["ServerScriptService", "ServerStorage"],
					shared: ["ReplicatedStorage"],
					testing: ["TestService"],
				},
				outputFileName: "problematic",
				projectFile: DEFAULT,
			} satisfies PendantConfiguration;

			const result = isPendantConfiguration.safeParse(validConfiguration);

			expect(result.success).toBe(true);
		});

		it("should validate a minimal configuration", () => {
			const minimalConfiguration = {
				files: {
					client: [],
					server: [],
					shared: [],
				},
			} satisfies PendantConfiguration;

			const result = isPendantConfiguration.safeParse(minimalConfiguration);

			expect(result.success).toBe(true);

			if (result.success) {
				expect(result.data.outputFileName).toBe("problematic");
				expect(result.data.projectFile).toBe(DEFAULT);
			}
		});

		it("should validate configuration with optional testing array", () => {
			const configurationWithTesting = {
				files: {
					client: ["ReplicatedFirst"],
					server: ["ServerScriptService"],
					shared: ["ReplicatedStorage"],
					testing: ["TestService"],
				},
			} satisfies PendantConfiguration;

			const result = isPendantConfiguration.safeParse(configurationWithTesting);

			expect(result.success).toBe(true);
		});

		it("should validate configuration without testing array", () => {
			const configurationWithoutTesting = {
				files: {
					client: ["ReplicatedFirst"],
					server: ["ServerScriptService"],
					shared: ["ReplicatedStorage"],
				},
			} satisfies PendantConfiguration;

			const result = isPendantConfiguration.safeParse(configurationWithoutTesting);

			expect(result.success).toBe(true);
		});

		it("should reject configuration missing required files", () => {
			const invalidConfiguration = {
				outputFileName: "problematic",
				projectFile: DEFAULT,
			};

			const result = isPendantConfiguration.safeParse(invalidConfiguration);

			expect(result.success).toBe(false);
		});

		it("should reject configuration with invalid project file extension", () => {
			const invalidConfiguration = {
				files: {
					client: [],
					server: [],
					shared: [],
				},
				projectFile: "invalid.json",
			};

			const result = isPendantConfiguration.safeParse(invalidConfiguration);

			expect(result.success).toBe(false);
		});

		it("should reject configuration with non-string array elements", () => {
			const invalidConfiguration = {
				files: {
					client: [123, "ReplicatedFirst"],
					server: [],
					shared: [],
				},
			};

			const result = isPendantConfiguration.safeParse(invalidConfiguration);

			expect(result.success).toBe(false);
		});

		it("should allow $schema property and ignore it", () => {
			const configurationWithSchema = {
				$schema: "https://example.com/schema.json",
				files: {
					client: [],
					server: [],
					shared: [],
				},
			};

			const result = isPendantConfiguration.safeParse(configurationWithSchema);

			expect(result.success).toBe(true);
		});
	});

	describe("getPendantConfigurationAsync", () => {
		it("should read and parse a valid configuration file", async () => {
			const configurationPath = join(temporaryDirectory, "valid.pendant.json");
			const configurationData = {
				files: {
					client: ["ReplicatedFirst", "StarterPlayer"],
					server: ["ServerScriptService", "ServerStorage"],
					shared: ["ReplicatedStorage"],
					testing: ["TestService"],
				},
				outputFileName: "custom-output",
				projectFile: "custom.project.json",
			} satisfies PendantConfiguration;

			await writeFile(configurationPath, JSON.stringify(configurationData, null, 2));

			const result = await getPendantConfigurationAsync(configurationPath);

			expect(result.files.client).toEqual(["ReplicatedFirst", "StarterPlayer"]);
			expect(result.files.server).toEqual(["ServerScriptService", "ServerStorage"]);
			expect(result.files.shared).toEqual(["ReplicatedStorage"]);
			expect(result.files.testing).toEqual(["TestService"]);
			expect(result.outputFileName).toBe("custom-output");
			expect(result.projectFile).toBe("custom.project.json");
		});

		it("should read configuration with defaults applied", async () => {
			const configurationPath = join(temporaryDirectory, "minimal.pendant.json");
			const configurationData = {
				files: {
					client: ["ReplicatedFirst"],
					server: ["ServerScriptService"],
					shared: ["ReplicatedStorage"],
				},
			} satisfies PendantConfiguration;

			await writeFile(configurationPath, JSON.stringify(configurationData, null, 2));

			const result = await getPendantConfigurationAsync(configurationPath);

			expect(result.outputFileName).toBe("problematic");
			expect(result.projectFile).toBe(DEFAULT);
		});

		it("should remove $schema property from result", async () => {
			const configurationPath = join(temporaryDirectory, "schema.pendant.json");
			const configurationData = {
				$schema: "https://example.com/schema.json",
				files: {
					client: [],
					server: [],
					shared: [],
				},
			};

			await writeFile(configurationPath, JSON.stringify(configurationData, null, 2));

			const result = await getPendantConfigurationAsync(configurationPath);

			expect("$schema" in result).toBe(false);
		});

		it("should throw error if file does not exist", () => {
			const nonExistentPath = join(temporaryDirectory, "nonexistent.json");

			expect(getPendantConfigurationAsync(nonExistentPath)).rejects.toThrow("Project file does not exist:");
		});

		it("should throw error if file contains invalid JSON", async () => {
			const configurationPath = join(temporaryDirectory, "invalid.pendant.json");
			await writeFile(configurationPath, INVALID_JSON);

			expect(getPendantConfigurationAsync(configurationPath)).rejects.toThrow();
		});

		it("should throw error if configuration is invalid", async () => {
			const configurationPath = join(temporaryDirectory, "invalid-config.pendant.json");
			const invalidConfiguration = {
				files: {
					// Missing required properties
				},
			};

			await writeFile(configurationPath, JSON.stringify(invalidConfiguration, null, 2));

			expect(getPendantConfigurationAsync(configurationPath)).rejects.toThrow();
		});
	});

	getFirstTest(() => temporaryDirectory, getFirstConfigurationAsync);
});
