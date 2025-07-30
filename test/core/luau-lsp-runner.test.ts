import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
	downloadGlobalTypesAsync,
	generateSourcemapAsync,
	type LuauLspAnalysisOptions,
	LuauLspRunner,
	type PrivateLuauLspRunner,
} from "core/luau-lsp-runner";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rimraf } from "rimraf";

const SOURCEMAP = "sourcemap.json";
const GLOBAL_TYPES_FILE = "globalTypes.d.luau";

describe("luau-lsp-runner", () => {
	let temporaryDirectory: string;
	let runner: LuauLspRunner;

	beforeEach(async () => {
		temporaryDirectory = await mkdtemp(join(tmpdir(), "luau-lsp-test-"));
		runner = new LuauLspRunner(temporaryDirectory);
	});

	afterEach(async () => {
		await rimraf(temporaryDirectory);
	});

	describe("LuauLspRunner", () => {
		describe("constructor", () => {
			it("should use provided working directory", () => {
				const customRunner = new LuauLspRunner("/custom/path");

				expect(customRunner).toBeDefined();
			});

			it("should use process.cwd() as default", () => {
				const defaultRunner = new LuauLspRunner();

				expect(defaultRunner).toBeDefined();
			});
		});

		describe("buildCommandAsync", () => {
			it("should build basic command with required options", async () => {
				// Create expected files so they're included in the command
				await Bun.write(`${temporaryDirectory}/.luaurc`, "{}");
				await Bun.$`mkdir -p ${temporaryDirectory}/.vscode`;
				await Bun.write(`${temporaryDirectory}/.vscode/settings.json`, "{}");
				await Bun.write(`${temporaryDirectory}/sourcemap.json`, "{}");

				// Create some files that match the default ignore patterns
				await Bun.$`mkdir -p ${temporaryDirectory}/DevPackages`;
				await Bun.$`mkdir -p ${temporaryDirectory}/Packages`;
				await Bun.write(`${temporaryDirectory}/DevPackages/test.luau`, "");
				await Bun.write(`${temporaryDirectory}/Packages/test.luau`, "");

				const options: LuauLspAnalysisOptions = {
					// Explicitly set paths to ensure they're checked in the temp directory
					baseConfigPath: ".luaurc",
					paths: ["src/", "lib/"],
					settingsPath: ".vscode/settings.json",
					sourcemapPath: "sourcemap.json",
				};

				// Access private method for testing
				const command = await (runner as unknown as PrivateLuauLspRunner).buildCommandAsync(options);

				expect(command).toContain("luau-lsp");
				expect(command).toContain("analyze");
				expect(command).toContain("--definitions=globalTypes.d.luau");
				expect(command).toContain("--base-luaurc=.luaurc");
				expect(command).toContain("--sourcemap=sourcemap.json");
				expect(command).toContain("--settings=.vscode/settings.json");
				expect(command).toContain("--no-strict-dm-types");
				expect(command).toContain("src/");
				expect(command).toContain("lib/");
			});

			it("should use custom paths when provided", async () => {
				// Create custom files so they're included in the command
				await Bun.write(`${temporaryDirectory}/custom.luaurc`, "{}");
				await Bun.write(`${temporaryDirectory}/custom-settings.json`, "{}");
				await Bun.write(`${temporaryDirectory}/custom-sourcemap.json`, "{}");

				const options: LuauLspAnalysisOptions = {
					baseConfigPath: "custom.luaurc",
					definitionsPath: "custom-types.d.luau",
					paths: ["custom/path"],
					settingsPath: "custom-settings.json",
					sourcemapPath: "custom-sourcemap.json",
				};

				const command = await (runner as unknown as PrivateLuauLspRunner).buildCommandAsync(options);

				expect(command).toContain("--definitions=custom-types.d.luau");
				expect(command).toContain("--base-luaurc=custom.luaurc");
				expect(command).toContain("--sourcemap=custom-sourcemap.json");
				expect(command).toContain("--settings=custom-settings.json");
				expect(command).toContain("custom/path");
			});

			it("should not include any ignore patterns when none are provided", async () => {
				const options: LuauLspAnalysisOptions = {
					paths: ["src/"],
				};

				const command = await (runner as unknown as PrivateLuauLspRunner).buildCommandAsync(options);

				// Should not contain any --ignore flags
				const ignoreFlags = command.filter((argument) => argument.startsWith("--ignore="));

				expect(ignoreFlags).toHaveLength(0);
			});

			it("should include custom ignore patterns", async () => {
				// Create files that match the custom ignore patterns
				await Bun.$`mkdir -p ${temporaryDirectory}/custom`;
				await Bun.$`mkdir -p ${temporaryDirectory}/temp`;
				await Bun.write(`${temporaryDirectory}/custom/test.luau`, "");
				await Bun.write(`${temporaryDirectory}/temp/test.lua`, "");

				const options: LuauLspAnalysisOptions = {
					ignorePatterns: ["custom/**/*.luau", "temp/**/*.lua"],
					paths: ["src/"],
				};

				const command = await (runner as unknown as PrivateLuauLspRunner).buildCommandAsync(options);

				expect(command).toContain('--ignore="custom/**/*.luau"');
				expect(command).toContain('--ignore="temp/**/*.lua"');
			});

			it("should handle paths with spaces and special characters", async () => {
				const options: LuauLspAnalysisOptions = {
					paths: ["path with spaces/", "path-with-dashes/", "path_with_underscores/"],
				};

				const command = await (runner as unknown as PrivateLuauLspRunner).buildCommandAsync(options);

				expect(command).toContain("path with spaces/");
				expect(command).toContain("path-with-dashes/");
				expect(command).toContain("path_with_underscores/");
			});
		});

		describe("executeAnalysisAsync", () => {
			it("should handle successful execution", async () => {
				// Mock Bun.spawn to simulate successful luau-lsp execution
				const mockSpawn = spyOn(Bun, "spawn").mockImplementation(() => {
					const mockProcess = {
						exited: Promise.resolve(0),
						stderr: new ReadableStream({
							start(controller) {
								controller.enqueue(new TextEncoder().encode(""));
								controller.close();
							},
						}),
						stdout: new ReadableStream({
							start(controller) {
								controller.enqueue(new TextEncoder().encode("Analysis complete"));
								controller.close();
							},
						}),
					};
					return mockProcess as Bun.Subprocess;
				});

				const options: LuauLspAnalysisOptions = {
					paths: ["src/"],
				};

				const result = await runner.executeAnalysisAsync(options);

				expect(result.success).toBe(true);
				expect(result.exitCode).toBe(0);
				expect(result.stdout).toBe("Analysis complete");
				expect(result.stderr).toBe("");

				mockSpawn.mockRestore();
			});

			it("should handle failed execution", async () => {
				const mockSpawn = spyOn(Bun, "spawn").mockImplementation(() => {
					const mockProcess = {
						exited: Promise.resolve(1),
						stderr: new ReadableStream({
							start(controller) {
								controller.enqueue(new TextEncoder().encode("Analysis failed"));
								controller.close();
							},
						}),
						stdout: new ReadableStream({
							start(controller) {
								controller.enqueue(new TextEncoder().encode(""));
								controller.close();
							},
						}),
					};
					return mockProcess as Bun.Subprocess;
				});

				const options: LuauLspAnalysisOptions = {
					paths: ["src/"],
				};

				const result = await runner.executeAnalysisAsync(options);

				expect(result.success).toBe(false);
				expect(result.exitCode).toBe(1);
				expect(result.stdout).toBe("");
				expect(result.stderr).toBe("Analysis failed");

				mockSpawn.mockRestore();
			});

			it("should handle spawn errors", async () => {
				const mockSpawn = spyOn(Bun, "spawn").mockImplementation(() => {
					throw new Error("Command not found");
				});

				const options: LuauLspAnalysisOptions = {
					paths: ["src/"],
				};

				const result = await runner.executeAnalysisAsync(options);

				expect(result.success).toBe(false);
				expect(result.exitCode).toBe(-1);
				expect(result.stderr).toContain("Command not found");

				mockSpawn.mockRestore();
			});

			it("should use correct working directory", async () => {
				const mockSpawn = spyOn(Bun, "spawn").mockImplementation((options) => {
					if (Array.isArray(options)) throw new Error("Expected options to be an object");

					expect(options?.cwd).toBe(temporaryDirectory);

					const mockProcess = {
						exited: Promise.resolve(0),
						stderr: new ReadableStream({
							start(controller) {
								controller.close();
							},
						}),
						stdout: new ReadableStream({
							start(controller) {
								controller.close();
							},
						}),
					};
					return mockProcess as never;
				});

				const analysisOptions: LuauLspAnalysisOptions = {
					paths: ["src/"],
				};

				await runner.executeAnalysisAsync(analysisOptions);

				mockSpawn.mockRestore();
			});

			it("should log command in verbose mode", async () => {
				const mockSpawn = spyOn(Bun, "spawn").mockImplementation(() => {
					const mockProcess = {
						exited: Promise.resolve(0),
						stderr: new ReadableStream({
							start(controller) {
								controller.close();
							},
						}),
						stdout: new ReadableStream({
							start(controller) {
								controller.close();
							},
						}),
					};
					return mockProcess as Bun.Subprocess;
				});

				const options: LuauLspAnalysisOptions = {
					paths: ["src/"],
					verbose: true,
				};

				await runner.executeAnalysisAsync(options);

				mockSpawn.mockRestore();
			});
		});
	});

	describe("downloadGlobalTypesAsync", () => {
		it("should download and save globalTypes.d.luau", async () => {
			// Mock fetch to return a successful response
			const mockFetch = spyOn(Bun, "fetch").mockResolvedValue(
				new Response("-- Global types content", {
					status: 200,
					statusText: "OK",
				}),
			);

			const mockWrite = spyOn(Bun, "write").mockResolvedValue(100);

			const targetPath = join(temporaryDirectory, GLOBAL_TYPES_FILE);
			await downloadGlobalTypesAsync(targetPath);

			expect(mockFetch).toHaveBeenCalledWith(
				"https://raw.githubusercontent.com/JohnnyMorganz/luau-lsp/main/scripts/globalTypes.d.luau",
				{ verbose: false },
			);
			expect(mockWrite).toHaveBeenCalledWith(targetPath, "-- Global types content");

			mockFetch.mockRestore();
			mockWrite.mockRestore();
		});

		it("should handle download failures", async () => {
			const mockFetch = spyOn(Bun, "fetch").mockResolvedValue(
				new Response("Not Found", {
					status: 404,
					statusText: "Not Found",
				}),
			);

			const targetPath = join(temporaryDirectory, GLOBAL_TYPES_FILE);

			// eslint-disable-next-line ts/await-thenable, ts/no-confusing-void-expression -- required
			await expect(downloadGlobalTypesAsync(targetPath)).rejects.toThrow("Failed to download: 404 Not Found");

			mockFetch.mockRestore();
		});

		it("should handle network errors", async () => {
			const mockFetch = spyOn(Bun, "fetch").mockRejectedValue(new Error("Network error"));

			const targetPath = join(temporaryDirectory, GLOBAL_TYPES_FILE);

			// eslint-disable-next-line ts/await-thenable, ts/no-confusing-void-expression -- required
			await expect(downloadGlobalTypesAsync(targetPath)).rejects.toThrow("Network error");

			mockFetch.mockRestore();
		});
	});

	describe("generateSourcemapAsync", () => {
		it("should generate sourcemap successfully", async () => {
			const mockSpawn = spyOn(Bun, "spawn").mockImplementation(() => {
				const mockProcess = {
					exited: Promise.resolve(0),
					stderr: new ReadableStream({
						start(controller) {
							controller.close();
						},
					}),
				};
				return mockProcess as Bun.Subprocess;
			});

			const projectFile = join(temporaryDirectory, "test.project.json");
			const outputPath = join(temporaryDirectory, SOURCEMAP);

			await generateSourcemapAsync(projectFile, outputPath);

			expect(mockSpawn).toHaveBeenCalledWith(["rojo", "sourcemap", "--output", outputPath, projectFile], {
				stderr: "pipe",
				stdout: "pipe",
			});

			mockSpawn.mockRestore();
		});

		it("should handle rojo command failures", async () => {
			const mockSpawn = spyOn(Bun, "spawn").mockImplementation(() => {
				const mockProcess = {
					exited: Promise.resolve(1),
					stderr: new ReadableStream({
						start(controller) {
							controller.enqueue(new TextEncoder().encode("Rojo error"));
							controller.close();
						},
					}),
				};
				return mockProcess as Bun.Subprocess;
			});

			const projectFile = join(temporaryDirectory, "test.project.json");
			const outputPath = join(temporaryDirectory, SOURCEMAP);

			expect(generateSourcemapAsync(projectFile, outputPath)).rejects.toThrow("Rojo sourcemap generation failed");

			mockSpawn.mockRestore();
		});

		it("should use default paths when not provided", async () => {
			const mockSpawn = spyOn(Bun, "spawn").mockImplementation((command) => {
				expect(command).toEqual(["rojo", "sourcemap", "--output", SOURCEMAP, "default.project.json"]);

				const mockProcess = {
					exited: Promise.resolve(0),
					stderr: new ReadableStream({
						start(controller) {
							controller.close();
						},
					}),
				};
				return mockProcess as Bun.Subprocess;
			});

			await generateSourcemapAsync();

			mockSpawn.mockRestore();
		});
	});

	describe("cross-platform process spawning", () => {
		it("should work with platform-specific executable extensions", async () => {
			// Test that commands work regardless of platform
			const mockSpawn = spyOn(Bun, "spawn").mockImplementation((command) => {
				// On Windows, executables might have .exe extension, but Bun should handle this
				expect(Array.isArray(command)).toBe(true);

				if (!Array.isArray(command)) throw new Error("Expected command to be an array");

				expect(command.length).toBeGreaterThan(0);

				const mockProcess = {
					exited: Promise.resolve(0),
					stderr: new ReadableStream({
						start(controller) {
							controller.close();
						},
					}),
					stdout: new ReadableStream({
						start(controller) {
							controller.close();
						},
					}),
				};
				return mockProcess as Bun.Subprocess;
			});

			const options: LuauLspAnalysisOptions = {
				paths: ["src/"],
			};

			await runner.executeAnalysisAsync(options);

			mockSpawn.mockRestore();
		});

		it("should handle paths with different separators", async () => {
			const mockSpawn = spyOn(Bun, "spawn").mockImplementation(() => {
				const mockProcess = {
					exited: Promise.resolve(0),
					stderr: new ReadableStream({
						start(controller) {
							controller.close();
						},
					}),
					stdout: new ReadableStream({
						start(controller) {
							controller.close();
						},
					}),
				};
				return mockProcess as Bun.Subprocess;
			});

			const options: LuauLspAnalysisOptions = {
				paths: ["src\\windows\\path", "src/unix/path"],
			};

			const result = await runner.executeAnalysisAsync(options);

			expect(result.success).toBe(true);

			mockSpawn.mockRestore();
		});
	});
});
