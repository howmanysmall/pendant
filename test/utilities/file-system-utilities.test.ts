import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { rimraf } from "rimraf";
import {
	ContentType,
	copyFileAsync,
	doesPathExistAsync,
	FileType,
	fromPathLike,
	getChildrenAsync,
	getDescendantsAsync,
	getDirectoriesAsync,
	getExtension,
	getFilesAsync,
	getFileTypeAsync,
	getPathWithoutExtension,
	makeDirectoryAsync,
	readFileAsync,
	removeFileAsync,
	validatePathExistsAsync,
	writeFileAsync,
} from "utilities/file-system-utilities";

const HELLO_WORLD = "Hello, World!";
const SUPPORT_MOCK_MODE = "should support mock mode";

const MATCH_DRIVE_LETTER = /^[A-Z]:\\/;
const MATCH_UNIX_ROOT = /^\//;

describe("file-system-utilities", () => {
	let temporaryDirectory: string;

	beforeEach(async () => {
		temporaryDirectory = await mkdtemp(join(tmpdir(), "fs-test-"));
	});

	afterEach(async () => {
		await rimraf(temporaryDirectory);
	});

	describe("fromPathLike", () => {
		it("should handle string paths", () => {
			expect(fromPathLike("test.txt")).toBe("test.txt");
		});

		it("should handle URL paths", () => {
			const url = new URL("file:///path/to/file.txt");

			expect(fromPathLike(url)).toBe("/path/to/file.txt");
		});

		it("should handle Buffer paths (if Buffer is available)", () => {
			if (typeof Buffer === "undefined") return;
			const buffer = Buffer.from("test.txt");

			expect(fromPathLike(buffer)).toBe("test.txt");
		});

		it("should handle ArrayBuffer paths", () => {
			const encoder = new TextEncoder();
			const arrayBuffer = encoder.encode("test.txt").buffer;

			expect(fromPathLike(arrayBuffer)).toBe("test.txt");
		});

		it("should handle Uint8Array paths", () => {
			const encoder = new TextEncoder();
			const uint8Array = encoder.encode("test.txt");

			expect(fromPathLike(uint8Array)).toBe("test.txt");
		});

		it("should throw for unsupported types", () => {
			expect(() => fromPathLike(123 as unknown as Bun.PathLike)).toThrow("Unsupported path type");
		});
	});

	describe("path operations - cross-platform", () => {
		it("should handle paths with platform-specific separators", async () => {
			const testFile = join(temporaryDirectory, "test.txt");
			await writeFile(testFile, "content");

			// Test that our functions work regardless of platform separator
			const exists = await doesPathExistAsync(testFile);

			expect(exists).toBe(true);

			// Test with manually constructed paths using both separators
			const unixStylePath = `${temporaryDirectory.replace(/\\/g, "/")}/test.txt`;
			const windowsStylePath = `${temporaryDirectory.replace(/\//g, "\\")}\\test.txt`;

			if (sep === "/") expect(await doesPathExistAsync(unixStylePath)).toBe(true);
			else expect(await doesPathExistAsync(windowsStylePath)).toBe(true);
		});

		it("should resolve absolute paths correctly on all platforms", async () => {
			const testFile = join(temporaryDirectory, "nested", "deep", "test.txt");
			await writeFileAsync(testFile, "content", { createPath: true });

			const absolutePath = resolve(testFile);

			expect(await doesPathExistAsync(absolutePath)).toBe(true);

			// Verify path is actually absolute
			// If Windows: should start with drive letter
			// If Unix-like: should start with /
			if (sep === "\\") expect(absolutePath).toMatch(MATCH_DRIVE_LETTER);
			else expect(absolutePath).toMatch(MATCH_UNIX_ROOT);
		});
	});

	describe("getExtension", () => {
		it("should return file extension with dot", () => {
			expect(getExtension("file.txt")).toBe(".txt");
			expect(getExtension("archive.tar.gz")).toBe(".gz");
		});

		it("should return empty string for files without extension", () => {
			expect(getExtension("filename")).toBe("");
			expect(getExtension("path/to/filename")).toBe("");
		});

		it("should handle platform-specific paths", () => {
			const windowsPath = "C:\\Users\\test\\file.txt";
			const unixPath = "/home/test/file.txt";

			expect(getExtension(windowsPath)).toBe(".txt");
			expect(getExtension(unixPath)).toBe(".txt");
		});
	});

	describe("getPathWithoutExtension", () => {
		it("should remove file extension", () => {
			expect(getPathWithoutExtension("file.txt")).toBe("file");
			expect(getPathWithoutExtension("path/to/file.json")).toBe("path/to/file");
		});

		it("should handle files without extension", () => {
			expect(getPathWithoutExtension("filename")).toBe("filename");
		});

		it("should handle platform-specific paths", () => {
			const windowsPath = "C:\\Users\\test\\file.txt";
			const unixPath = "/home/test/file.txt";

			expect(getPathWithoutExtension(windowsPath)).toBe("C:\\Users\\test\\file");
			expect(getPathWithoutExtension(unixPath)).toBe("/home/test/file");
		});
	});

	describe("readFileAsync", () => {
		it("should read text content", async () => {
			const testFile = join(temporaryDirectory, "test.txt");
			const content = HELLO_WORLD;
			await writeFile(testFile, content);

			const result = await readFileAsync(testFile, ContentType.Text);

			expect(result).toBe(content);
		});

		it("should read JSON content", async () => {
			const testFile = join(temporaryDirectory, "test.json");
			const content = { message: HELLO_WORLD };
			await writeFile(testFile, JSON.stringify(content));

			const result = await readFileAsync(testFile, ContentType.Json);

			expect(result).toEqual(content);
		});

		it("should read binary content as ArrayBuffer", async () => {
			const testFile = join(temporaryDirectory, "test.bin");
			const content = new Uint8Array([1, 2, 3, 4, 5]);
			await writeFile(testFile, content);

			const result = await readFileAsync(testFile, ContentType.ArrayBuffer);

			expect(new Uint8Array(result)).toEqual(content);
		});

		it("should throw for non-existent files", async () => {
			const nonExistentFile = join(temporaryDirectory, "nonexistent.txt");

			expect(readFileAsync(nonExistentFile, ContentType.Text)).rejects.toThrow("File does not exist at path:");
		});
	});

	describe("writeFileAsync", () => {
		it("should write text content", async () => {
			const testFile = join(temporaryDirectory, "output.txt");
			const content = HELLO_WORLD;

			const bytesWritten = await writeFileAsync(testFile, content, { createPath: true });

			expect(bytesWritten).toBeGreaterThan(0);

			const readContent = await readFileAsync(testFile, ContentType.Text);

			expect(readContent).toBe(content);
		});

		it("should create parent directories when createPath is true", async () => {
			const testFile = join(temporaryDirectory, "nested", "deep", "output.txt");
			const content = "content";

			await writeFileAsync(testFile, content, { createPath: true });

			const exists = await doesPathExistAsync(testFile);

			expect(exists).toBe(true);
		});

		it(SUPPORT_MOCK_MODE, async () => {
			const testFile = join(temporaryDirectory, "mock.txt");
			const content = "content";

			const bytesWritten = await writeFileAsync(testFile, content, { mockMode: true });

			expect(bytesWritten).toBe(0);

			const exists = await doesPathExistAsync(testFile);

			expect(exists).toBe(false);
		});
	});

	describe("copyFileAsync", () => {
		it("should copy file content", async () => {
			const sourceFile = join(temporaryDirectory, "source.txt");
			const destinationFile = join(temporaryDirectory, "destination.txt");
			const content = "File content to copy";

			await writeFile(sourceFile, content);
			await copyFileAsync(sourceFile, destinationFile);

			const copiedContent = await readFileAsync(destinationFile, ContentType.Text);

			expect(copiedContent).toBe(content);
		});

		it("should create parent directories for destination", async () => {
			const sourceFile = join(temporaryDirectory, "source.txt");
			const destinationFile = join(temporaryDirectory, "nested", "destination.txt");
			const content = "File content";

			await writeFile(sourceFile, content);
			await copyFileAsync(sourceFile, destinationFile, { createPath: true });

			const exists = await doesPathExistAsync(destinationFile);

			expect(exists).toBe(true);
		});
	});

	describe("makeDirectoryAsync", () => {
		it("should create directory", async () => {
			const directoryPath = join(temporaryDirectory, "new-directory");

			await makeDirectoryAsync(directoryPath);

			const exists = await doesPathExistAsync(directoryPath);

			expect(exists).toBe(true);

			const fileType = await getFileTypeAsync(directoryPath);

			expect(fileType).toBe(FileType.Directory);
		});

		it("should create nested directories when recursive is true", async () => {
			const directoryPath = join(temporaryDirectory, "level1", "level2", "level3");

			await makeDirectoryAsync(directoryPath, { recursive: true });

			const exists = await doesPathExistAsync(directoryPath);

			expect(exists).toBe(true);
		});

		it(SUPPORT_MOCK_MODE, async () => {
			const directoryPath = join(temporaryDirectory, "mock-directory");

			await makeDirectoryAsync(directoryPath, { mockMode: true });

			const exists = await doesPathExistAsync(directoryPath);

			expect(exists).toBe(false);
		});
	});

	describe("removeFileAsync", () => {
		it("should remove files", async () => {
			const testFile = join(temporaryDirectory, "to-remove.txt");
			await writeFile(testFile, "content");

			const result = await removeFileAsync(testFile);

			expect(result).toBe(true);

			const exists = await doesPathExistAsync(testFile);

			expect(exists).toBe(false);
		});

		it("should remove directories recursively", async () => {
			const directoryPath = join(temporaryDirectory, "dir-to-remove");
			const filePath = join(directoryPath, "file.txt");

			await makeDirectoryAsync(directoryPath);
			await writeFile(filePath, "content");

			const result = await removeFileAsync(directoryPath);

			expect(result).toBe(true);

			const exists = await doesPathExistAsync(directoryPath);

			expect(exists).toBe(false);
		});

		it(SUPPORT_MOCK_MODE, async () => {
			const testFile = join(temporaryDirectory, "mock-remove.txt");
			await writeFile(testFile, "content");

			const result = await removeFileAsync(testFile, { mockMode: true });

			expect(result).toBe(true);

			// File should still exist in mock mode
			const exists = await doesPathExistAsync(testFile);

			expect(exists).toBe(true);
		});
	});

	describe("directory traversal", () => {
		beforeEach(async () => {
			// Create test directory structure
			await makeDirectoryAsync(join(temporaryDirectory, "dir1"), { recursive: true });
			await makeDirectoryAsync(join(temporaryDirectory, "dir2"), { recursive: true });
			await makeDirectoryAsync(join(temporaryDirectory, "dir1", "subdir"), { recursive: true });

			await writeFile(join(temporaryDirectory, "file1.txt"), "content1");
			await writeFile(join(temporaryDirectory, "file2.js"), "content2");
			await writeFile(join(temporaryDirectory, "dir1", "nested.txt"), "nested");
			await writeFile(join(temporaryDirectory, "dir1", "subdir", "deep.txt"), "deep");
		});

		it("should get immediate children", async () => {
			const children = await getChildrenAsync(temporaryDirectory);

			expect(children).toHaveLength(4); // dir1, dir2, file1.txt, file2.js
			expect(children).toEqual(
				expect.arrayContaining([
					expect.stringContaining("dir1"),
					expect.stringContaining("dir2"),
					expect.stringContaining("file1.txt"),
					expect.stringContaining("file2.js"),
				]),
			);
		});

		it("should get only directories", async () => {
			const directories = await getDirectoriesAsync(temporaryDirectory);

			expect(directories).toHaveLength(2);
			expect(directories).toEqual(
				expect.arrayContaining([expect.stringContaining("dir1"), expect.stringContaining("dir2")]),
			);
		});

		it("should get only files", async () => {
			const files = await getFilesAsync(temporaryDirectory);

			expect(files).toHaveLength(2);
			expect(files).toEqual(
				expect.arrayContaining([expect.stringContaining("file1.txt"), expect.stringContaining("file2.js")]),
			);
		});

		it("should get all descendants recursively", async () => {
			const descendants = await getDescendantsAsync(temporaryDirectory);

			expect(descendants.length).toBeGreaterThanOrEqual(6); // All files and directories
			expect(descendants).toEqual(
				expect.arrayContaining([
					expect.stringContaining("deep.txt"), // Deep nested file
					expect.stringContaining("subdir"), // Nested directory
				]),
			);
		});
	});

	describe("validatePathExistsAsync", () => {
		it("should validate existing file", async () => {
			const testFile = join(temporaryDirectory, "validate.txt");
			await writeFile(testFile, "content");

			expect(validatePathExistsAsync(testFile, FileType.File)).resolves.toBeUndefined();
		});

		it("should validate existing directory", async () => {
			const testDirectory = join(temporaryDirectory, "validate-dir");
			await makeDirectoryAsync(testDirectory);

			expect(validatePathExistsAsync(testDirectory, FileType.Directory)).resolves.toBeUndefined();
		});

		it("should throw for non-existent path", async () => {
			const nonExistentPath = join(temporaryDirectory, "nonexistent");

			expect(validatePathExistsAsync(nonExistentPath, FileType.File)).rejects.toThrow("but it does not exist");
		});

		it("should throw for wrong file type", async () => {
			const testFile = join(temporaryDirectory, "wrong-type.txt");
			await writeFile(testFile, "content");

			expect(validatePathExistsAsync(testFile, FileType.Directory)).rejects.toThrow("but found something else");
		});
	});

	describe("getFileTypeAsync", () => {
		it("should identify files", async () => {
			const testFile = join(temporaryDirectory, "type-test.txt");
			await writeFile(testFile, "content");

			const fileType = await getFileTypeAsync(testFile);

			expect(fileType).toBe(FileType.File);
		});

		it("should identify directories", async () => {
			const testDirectory = join(temporaryDirectory, "type-test-dir");
			await makeDirectoryAsync(testDirectory);

			const fileType = await getFileTypeAsync(testDirectory);

			expect(fileType).toBe(FileType.Directory);
		});
	});

	describe("doesPathExistAsync", () => {
		it("should return true for existing paths", async () => {
			const testFile = join(temporaryDirectory, "exists.txt");
			await writeFile(testFile, "content");

			const exists = await doesPathExistAsync(testFile);

			expect(exists).toBe(true);
		});

		it("should return false for non-existent paths", async () => {
			const nonExistentPath = join(temporaryDirectory, "nonexistent");

			const exists = await doesPathExistAsync(nonExistentPath);

			expect(exists).toBe(false);
		});
	});
});
