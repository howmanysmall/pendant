import { describe, expect, it } from "bun:test";
import { isBunFile, isPathLike } from "utilities/bun-utilities";

describe("bun-utilities", () => {
	describe("isBunFile", () => {
		it("should return true for valid BunFile instances", () => {
			const file = Bun.file("test.txt");

			expect(isBunFile(file)).toBe(true);
		});

		it("should return false for regular Blob without name", () => {
			const blob = new Blob(["content"]);

			expect(isBunFile(blob)).toBe(false);
		});

		it("should return false for Blob with empty name", () => {
			const blob = new Blob(["content"]);
			Object.defineProperty(blob, "name", { value: "" });

			expect(isBunFile(blob)).toBe(false);
		});

		it("should return false for non-Blob objects", () => {
			expect(isBunFile("string")).toBe(false);
			expect(isBunFile(123)).toBe(false);
			expect(isBunFile({})).toBe(false);
			expect(isBunFile(null)).toBe(false);
			expect(isBunFile(undefined)).toBe(false);
		});

		it("should return false for objects with name property but not Blob", () => {
			const object = { name: "test.txt" };

			expect(isBunFile(object)).toBe(false);
		});
	});

	describe("isPathLike", () => {
		it("should return true for strings", () => {
			expect(isPathLike("test.txt")).toBe(true);
			expect(isPathLike("")).toBe(true);
			expect(isPathLike("/path/to/file")).toBe(true);
		});

		it("should return true for URL objects", () => {
			const url = new URL("file:///path/to/file.txt");

			expect(isPathLike(url)).toBe(true);
		});

		it("should return true for ArrayBuffer", () => {
			const arrayBuffer = new ArrayBuffer(10);

			expect(isPathLike(arrayBuffer)).toBe(true);
		});

		it("should return true for TypedArrays (excluding DataView)", () => {
			expect(isPathLike(new Uint8Array(10))).toBe(true);
			expect(isPathLike(new Uint16Array(10))).toBe(true);
			expect(isPathLike(new Uint32Array(10))).toBe(true);
			expect(isPathLike(new Int8Array(10))).toBe(true);
			expect(isPathLike(new Int16Array(10))).toBe(true);
			expect(isPathLike(new Int32Array(10))).toBe(true);
			expect(isPathLike(new Float32Array(10))).toBe(true);
			expect(isPathLike(new Float64Array(10))).toBe(true);
		});

		it("should return false for DataView", () => {
			const arrayBuffer = new ArrayBuffer(10);
			const dataView = new DataView(arrayBuffer);

			expect(isPathLike(dataView)).toBe(false);
		});

		it("should return false for other types", () => {
			expect(isPathLike(123)).toBe(false);
			expect(isPathLike(true)).toBe(false);
			expect(isPathLike({})).toBe(false);
			expect(isPathLike([])).toBe(false);
			expect(isPathLike(null)).toBe(false);
			expect(isPathLike(undefined)).toBe(false);
			expect(isPathLike(Symbol("test"))).toBe(false);
		});

		it("should handle Buffer if available", () => {
			// Buffer might not be available in all environments
			if (typeof Buffer === "undefined") return;

			const buffer = Buffer.from("test");

			// Buffer extends Uint8Array, so it should return true
			expect(isPathLike(buffer)).toBe(true);
		});
	});

	describe("cross-platform compatibility", () => {
		it("should work with platform-specific path strings", () => {
			// Windows-style paths
			expect(isPathLike("C:\\Users\\test\\file.txt")).toBe(true);
			// Unix-style paths
			expect(isPathLike("/home/test/file.txt")).toBe(true);
			// Relative paths
			expect(isPathLike("./relative/path.txt")).toBe(true);
			expect(isPathLike("../parent/file.txt")).toBe(true);
		});

		it("should work with file:// URLs on different platforms", () => {
			// Windows file URL
			const windowsUrl = new URL("file:///C:/Users/test/file.txt");

			expect(isPathLike(windowsUrl)).toBe(true);

			// Unix file URL
			const unixUrl = new URL("file:///home/test/file.txt");

			expect(isPathLike(unixUrl)).toBe(true);
		});
	});
});
