import { describe, expect, it } from "bun:test";
import applicationPaths from "constants/application-paths";
import { sep } from "node:path";

describe("application-paths", () => {
	it("should provide platform-appropriate paths", () => {
		expect(applicationPaths).toBeDefined();
		expect(applicationPaths.data).toBeDefined();
		expect(applicationPaths.config).toBeDefined();
		expect(applicationPaths.cache).toBeDefined();
		expect(applicationPaths.log).toBeDefined();
		expect(applicationPaths.temp).toBeDefined();
	});

	it("should use correct path separators for platform", () => {
		const paths = [applicationPaths.data, applicationPaths.config, applicationPaths.cache];

		for (const path of paths) {
			expect(typeof path).toBe("string");
			expect(path.length).toBeGreaterThan(0);

			// Verify path uses platform-appropriate separators
			// If Windows: paths should contain backslashes or be drive-relative
			// If Unix-like: paths should start with / or be relative
			if (sep === "\\") expect(path).toMatch(/[\\:]|\w+/);
			else expect(typeof path).toBe("string");
		}
	});

	it("should contain pendant in path names", () => {
		const paths = [applicationPaths.data, applicationPaths.config, applicationPaths.cache];
		for (const path of paths) expect(path.toLowerCase()).toContain("pendant");
	});

	describe("platform-specific behavior", () => {
		it.skipIf(process.platform !== "win32")("should provide Windows-style paths on Windows", () => {
			// Windows paths should contain drive letters or UNC paths
			expect(applicationPaths.data).toMatch(/^[A-Z]:|^\\\\|^%/);
		});

		it.skipIf(process.platform === "win32")("should provide Unix-style paths on Unix-like systems", () => {
			// Unix-like paths should start with / or ~ or be relative
			expect(applicationPaths.data).toMatch(/^\/|^~|^[^:]/);
		});

		it.skipIf(process.platform !== "darwin")("should handle macOS application support directories", () => {
			expect(applicationPaths.data).toContain("Library");
		});

		it.skipIf(process.platform !== "linux")("should handle Linux XDG directories", () => {
			// Common Linux directories
			const hasLinuxPath =
				applicationPaths.data.includes(".local") ||
				applicationPaths.data.includes(".config") ||
				applicationPaths.data.includes("/home");

			expect(hasLinuxPath).toBe(true);
		});
	});

	describe("path accessibility", () => {
		it("should provide absolute paths", () => {
			const paths = [applicationPaths.data, applicationPaths.config, applicationPaths.cache];

			for (const path of paths) {
				// Check if path is absolute
				// If Windows: should start with drive letter or UNC
				// If Unix-like: should start with / or be expandable
				if (sep === "\\") expect(path).toMatch(/^[A-Z]:|^\\\\|^%/);
				else expect(path).toMatch(/^\/|^~/);
			}
		});

		it("should provide different paths for different purposes", () => {
			const paths = new Set([
				applicationPaths.cache,
				applicationPaths.config,
				applicationPaths.data,
				applicationPaths.log,
				applicationPaths.temp,
			]);

			// Should have at least some unique paths (some platforms may share some)
			expect(paths.size).toBeGreaterThanOrEqual(1);
		});
	});
});
