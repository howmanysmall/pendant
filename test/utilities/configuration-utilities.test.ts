import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rimraf } from "rimraf";
import {
	getPendantConfigurationAsync,
	isPendantConfiguration,
	type PendantConfiguration,
} from "utilities/configuration-utilities";

const DEFAULT = "default.project.json";

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
			await writeFile(configurationPath, "{ invalid json }");

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
});
