import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import RuntimeContext from "meta/runtime-context";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rimraf } from "rimraf";
import type { PendantConfiguration } from "utilities/configuration-utilities";
import {
	collectFromConfigurationAsync,
	collectIntoRuntimeMap,
	collectPathsFromRuntimeMap,
	getProjectFromFileAsync,
	type RojoProject,
	type RuntimeEntryMap,
} from "utilities/rojo-project-utilities";

// Define regex patterns at module level to satisfy linting rules
const LOADER_PATH_REGEX = /src\/loader$/;
const SERVER_PATH_REGEX = /src\/server$/;
const SHARED_PATH_REGEX = /src\/shared$/;
const PACKAGES_PATH_REGEX = /Packages$/;
const ROOT_PATH_REGEX = /src\/root$/;
const NESTED_PATH_REGEX = /src\/nested$/;
const DEEP_PATH_REGEX = /src\/deep$/;
const ABSOLUTE_LOADER_PATH_REGEX = /^\/.*src\/loader$/;

const TEST_PROJECT = "Test Project";
const LOADER = "src/loader";
const TEST_PROJECT_JSON = "test.project.json";

describe("rojo-project-utilities", () => {
	let temporaryDirectory: string;

	beforeEach(async () => {
		temporaryDirectory = await mkdtemp(join(tmpdir(), "rojo-test-"));
	});

	afterEach(async () => {
		await rimraf(temporaryDirectory);
	});

	const createMockRojoProject = (): RojoProject => {
		// Create as JSON object similar to how it would be loaded from file
		const projectJson = {
			name: TEST_PROJECT,
			tree: {
				$className: "DataModel",
				$path: ".",
				ReplicatedFirst: {
					$className: "ReplicatedFirst",
					Loader: { $path: LOADER },
				},
				ReplicatedStorage: {
					$className: "ReplicatedStorage",
					Packages: { $path: "Packages" },
					Shared: { $path: "src/shared" },
				},
				ServerScriptService: {
					$className: "ServerScriptService",
					Server: { $path: "src/server" },
				},
				SoundService: {
					$className: "SoundService",
					Music: { $className: "SoundGroup" },
				},
				TestService: {
					$className: "TestService",
					DevPackages: { $path: "DevPackages" },
				},
			},
		};

		return projectJson as unknown as RojoProject;
	};

	const createMockConfiguration = (): PendantConfiguration => ({
		files: {
			client: ["ReplicatedFirst"],
			server: ["ServerScriptService"],
			shared: ["ReplicatedStorage", "TestService"], // Override TestService to shared
			testing: [],
		},
		outputFileName: "problematic",
		projectFile: TEST_PROJECT_JSON,
	});

	describe("getProjectFromFileAsync", () => {
		it("should read and parse a valid Rojo project file", async () => {
			const projectPath = join(temporaryDirectory, TEST_PROJECT_JSON);
			const projectData = createMockRojoProject();

			await writeFile(projectPath, JSON.stringify(projectData, null, 2));

			const result = await getProjectFromFileAsync(projectPath);

			expect(result.name).toBe(TEST_PROJECT);
			expect(result.tree.$className).toBe("DataModel");
			expect(result.tree.ReplicatedFirst?.$className).toBe("ReplicatedFirst");
		});

		it("should throw error for non-.project.json files", async () => {
			const invalidPath = join(temporaryDirectory, "invalid.json");
			await writeFile(invalidPath, "{}");

			expect(getProjectFromFileAsync(invalidPath)).rejects.toThrow("Expected a *.project.json file");
		});

		it("should throw error if file does not exist", () => {
			const nonExistentPath = join(temporaryDirectory, "nonexistent.project.json");

			expect(getProjectFromFileAsync(nonExistentPath)).rejects.toThrow("Project file does not exist:");
		});

		it("should throw error for invalid JSON", async () => {
			const projectPath = join(temporaryDirectory, "invalid.project.json");
			await writeFile(projectPath, "{ invalid json }");

			expect(getProjectFromFileAsync(projectPath)).rejects.toThrow();
		});
	});

	describe("collectIntoRuntimeMap", () => {
		it("should classify services based on configuration first", () => {
			const project = createMockRojoProject();
			const configuration = createMockConfiguration();

			const result = collectIntoRuntimeMap(project, configuration);

			// TestService should be in Shared because of configuration override
			// SoundService is also in Shared by default metadata
			expect(result[RuntimeContext.Shared]).toHaveLength(3); // ReplicatedStorage + TestService + SoundService
			expect(result[RuntimeContext.Testing]).toHaveLength(0); // TestService moved to Shared
			expect(result[RuntimeContext.Client]).toHaveLength(1); // ReplicatedFirst
			expect(result[RuntimeContext.Server]).toHaveLength(1); // ServerScriptService

			// Check that TestService is actually in Shared
			const testServiceEntry = result[RuntimeContext.Shared].find((entry) => entry.$className === "TestService");

			expect(testServiceEntry).toBeDefined();
		});

		it("should fall back to service metadata for unconfigured services", () => {
			const project = createMockRojoProject();
			const configuration = {
				files: {
					client: [],
					server: [],
					shared: [],
					testing: [],
				},
				outputFileName: "problematic",
				projectFile: TEST_PROJECT_JSON,
			} satisfies PendantConfiguration;

			const result = collectIntoRuntimeMap(project, configuration);

			// SoundService should be classified by its service metadata (Shared)
			const soundServiceEntry = result[RuntimeContext.Shared].find(
				(entry) => entry.$className === "SoundService",
			);

			expect(soundServiceEntry).toBeDefined();

			// TestService should be classified by its service metadata (Testing)
			const testServiceEntry = result[RuntimeContext.Testing].find((entry) => entry.$className === "TestService");

			expect(testServiceEntry).toBeDefined();
		});

		it("should handle services without className as Unknown", () => {
			const projectJson = {
				name: TEST_PROJECT,
				tree: {
					$className: "DataModel",
					$path: ".",
					UnknownService: {
						$className: "UnknownCustomClass", // Not a valid Roblox service
						$path: "src/unknown",
					},
				},
			};
			const project = projectJson as unknown as RojoProject;
			const configuration = createMockConfiguration();

			const result = collectIntoRuntimeMap(project, configuration);

			expect(result[RuntimeContext.Unknown]).toHaveLength(1);
		});

		it("should not duplicate services when both configured and in metadata", () => {
			const project = createMockRojoProject();
			const configuration = createMockConfiguration();

			const result = collectIntoRuntimeMap(project, configuration);

			// Count total entries across all contexts
			const totalEntries = Object.values(result).reduce((sum: number, entries) => sum + entries.length, 0);

			// Should have exactly 5 services: ReplicatedFirst, ReplicatedStorage, ServerScriptService, TestService, SoundService
			expect(totalEntries).toBe(5);
		});
	});

	describe("collectFromConfigurationAsync", () => {
		it("should load project and collect runtime map", async () => {
			const projectPath = join(temporaryDirectory, TEST_PROJECT_JSON);
			const projectData = createMockRojoProject();
			await writeFile(projectPath, JSON.stringify(projectData, null, 2));

			const configuration: PendantConfiguration = {
				...createMockConfiguration(),
				projectFile: projectPath, // Use absolute path
			};

			const [runtimeMap, rojoProject] = await collectFromConfigurationAsync(configuration);

			expect(rojoProject.name).toBe(TEST_PROJECT);
			expect(runtimeMap[RuntimeContext.Shared]).toHaveLength(3); // ReplicatedStorage + TestService + SoundService
		});

		it("should handle missing project file", async () => {
			const configuration = {
				files: {
					client: [],
					server: [],
					shared: [],
				},
				outputFileName: "problematic",
				projectFile: "nonexistent.project.json",
			} satisfies PendantConfiguration;

			expect(collectFromConfigurationAsync(configuration)).rejects.toThrow();
		});
	});

	describe("collectPathsFromRuntimeMap", () => {
		it("should extract all paths from runtime map entries", () => {
			const runtimeMapJson = {
				[RuntimeContext.Client]: [
					{
						$className: "ReplicatedFirst",
						$path: ".",
						Loader: { $path: LOADER },
					},
				],
				[RuntimeContext.Server]: [
					{
						$className: "ServerScriptService",
						$path: ".",
						Server: { $path: "src/server" },
					},
				],
				[RuntimeContext.Shared]: [
					{
						$className: "ReplicatedStorage",
						$path: ".",
						Packages: { $path: "Packages" },
						Shared: { $path: "src/shared" },
					},
				],
				[RuntimeContext.Testing]: [],
				[RuntimeContext.Unknown]: [],
			};
			const runtimeMap = runtimeMapJson as unknown as RuntimeEntryMap;

			const result = collectPathsFromRuntimeMap(runtimeMap);

			expect(result[RuntimeContext.Client]).toHaveLength(2);
			expect(result[RuntimeContext.Client][1]).toMatch(LOADER_PATH_REGEX);

			expect(result[RuntimeContext.Server]).toHaveLength(2);
			expect(result[RuntimeContext.Server][1]).toMatch(SERVER_PATH_REGEX);

			expect(result[RuntimeContext.Shared]).toHaveLength(3);
			expect(result[RuntimeContext.Shared]).toEqual(
				expect.arrayContaining([
					expect.stringMatching(SHARED_PATH_REGEX),
					expect.stringMatching(PACKAGES_PATH_REGEX),
				]),
			);

			expect(result[RuntimeContext.Testing]).toHaveLength(0);
			expect(result[RuntimeContext.Unknown]).toHaveLength(0);
		});

		it("should handle nested tree entries recursively", () => {
			const runtimeMapJson = {
				[RuntimeContext.Client]: [],
				[RuntimeContext.Server]: [],
				[RuntimeContext.Shared]: [
					{
						$className: "ReplicatedStorage",
						$path: "src/root",
						Nested: {
							$path: "src/nested",
							DeepNested: { $path: "src/deep" },
						},
					},
				],
				[RuntimeContext.Testing]: [],
				[RuntimeContext.Unknown]: [],
			};
			const runtimeMap = runtimeMapJson as unknown as RuntimeEntryMap;

			const result = collectPathsFromRuntimeMap(runtimeMap);

			expect(result[RuntimeContext.Shared]).toHaveLength(3);
			expect(result[RuntimeContext.Shared]).toEqual(
				expect.arrayContaining([
					expect.stringMatching(ROOT_PATH_REGEX),
					expect.stringMatching(NESTED_PATH_REGEX),
					expect.stringMatching(DEEP_PATH_REGEX),
				]),
			);
		});

		it("should handle entries without $path property", () => {
			const runtimeMapJson = {
				[RuntimeContext.Client]: [],
				[RuntimeContext.Server]: [],
				[RuntimeContext.Shared]: [
					{
						$className: "SoundService",
						Music: { $className: "SoundGroup" },
					},
				],
				[RuntimeContext.Testing]: [],
				[RuntimeContext.Unknown]: [],
			};
			const runtimeMap = runtimeMapJson as unknown as RuntimeEntryMap;

			const result = collectPathsFromRuntimeMap(runtimeMap);

			expect(result[RuntimeContext.Shared]).toHaveLength(0);
		});

		it("should return absolute paths", () => {
			const runtimeMapJson = {
				[RuntimeContext.Client]: [{ $path: LOADER }],
				[RuntimeContext.Server]: [],
				[RuntimeContext.Shared]: [],
				[RuntimeContext.Testing]: [],
				[RuntimeContext.Unknown]: [],
			};
			const runtimeMap = runtimeMapJson as unknown as RuntimeEntryMap;

			const result = collectPathsFromRuntimeMap(runtimeMap);

			expect(result[RuntimeContext.Client][0]).toMatch(ABSOLUTE_LOADER_PATH_REGEX);
		});
	});
});
