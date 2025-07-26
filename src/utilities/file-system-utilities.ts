import type { BlobPart, BunFile, BunInspectOptions, Glob, PathLike, S3File } from "bun";
import { createNamespaceLogger } from "logging/logger-utilities";
import type { Dirent, GlobOptions, Mode, Stats } from "node:fs";
import { lstat, mkdir, readdir, stat } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { rimraf } from "rimraf";
import type { z } from "zod/mini";
import { fromError } from "zod-validation-error";

import { isBunFile, isPathLike } from "./bun-utilities";
import { makeJsonSafe } from "./json-utilities";

const logger = createNamespaceLogger("file-system-utilities");
const INSPECT_OPTIONS = { colors: true } satisfies BunInspectOptions;

interface WithMockMode {
	/**
	 * If true, the operation will not actually edit the file system, but will
	 * log the intended operation.
	 *
	 * @default false
	 */
	readonly mockMode?: boolean;
}

/**
 * Enumerates supported file system entry types.
 *
 * Used to distinguish between directories and regular files in file system
 * operations.
 *
 * @example
 *
 * ```typescript
 * FileType.Directory; // 0
 * FileType.File; // 1
 * ```
 */
export const enum FileType {
	/** Represents a directory entry in the file system. */
	Directory = 0,
	/** Represents a regular file entry in the file system. */
	File = 1,
}

/**
 * Enumerates supported content types for file reading and writing operations.
 *
 * Used to specify the format in which file data should be interpreted or
 * returned.
 *
 * @remarks
 * This enum is used by {@linkcode readFileAsync} and related utilities to
 * control file decoding.
 */
export const enum ContentType {
	/** Read or write as an ArrayBuffer. */
	ArrayBuffer = 0,
	/** Read or write as a Uint8Array of bytes. */
	Bytes = 1,
	/** Read or write as FormData (for multipart/form-data). */
	FormData = 2,
	/** Read or write as parsed JSON. */
	Json = 3,
	/**
	 * Read or write as JSON, but with additional safety (e.g., comments
	 * allowed).
	 */
	JsonSafe = 4,
	/** Read or write as plain text. */
	Text = 5,
}

/**
 * Asynchronously retrieves all immediate children (files and directories) of a
 * given directory path.
 *
 * @example Const children = await getChildrenAsync("./src");
 *
 * @param path - The absolute or relative path to the directory.
 * @returns An array of absolute paths to each child entry. Returns an empty
 *   array if the path is not a directory.
 */
export async function getChildrenAsync(path: string): Promise<Array<string>> {
	try {
		const stats = await stat(path);
		if (!stats.isDirectory()) return [];

		const files = await readdir(path, { withFileTypes: true });
		const children = new Array<string>(files.length);
		let index = 0;
		for (const file of files) children[index++] = join(file.parentPath, file.name);
		return children;
	} catch {
		return [];
	}
}

/**
 * Asynchronously retrieves all immediate subdirectories of a given directory
 * path.
 *
 * @param path - The absolute or relative path to the directory.
 * @param ignoreGlobs - Optional array of Glob patterns to filter out matching
 *   directories.
 * @returns An array of absolute paths to each subdirectory. Returns an empty
 *   array if the path is not a directory.
 */
export async function getDirectoriesAsync(path: string, ignoreGlobs?: ReadonlyArray<Glob>): Promise<Array<string>> {
	try {
		const stats = await stat(path);
		if (!stats.isDirectory()) return [];

		const files = await readdir(path, { withFileTypes: true });
		const directories = new Array<string>();
		let length = 0;

		for (const file of files) {
			if (!file.isDirectory()) continue;
			const fullPath = join(file.parentPath, file.name);

			if (ignoreGlobs) {
				const shouldIgnore = ignoreGlobs.some((glob) => glob.match(fullPath));
				if (!shouldIgnore) directories[length++] = fullPath;
			} else directories[length++] = fullPath;
		}
		return directories;
	} catch {
		return [];
	}
}

/**
 * Asynchronously retrieves all files in a directory, excluding subdirectories.
 *
 * @param path - The absolute or relative path to the directory.
 * @param ignoreGlobs - Optional array of Glob patterns to filter out matching
 *   directories.
 * @returns An array of absolute paths to each file. Returns an empty array if
 *   the path is not a directory.
 */
export async function getFilesAsync(path: string, ignoreGlobs?: ReadonlyArray<Glob>): Promise<Array<string>> {
	try {
		const stats = await stat(path);
		if (!stats.isDirectory()) return [];

		const files = await readdir(path, { withFileTypes: true });
		const results = new Array<string>();
		let length = 0;

		for (const file of files) {
			if (!file.isFile()) continue;
			const fullPath = join(file.parentPath, file.name);

			if (ignoreGlobs) {
				const shouldIgnore = ignoreGlobs.some((glob) => glob.match(fullPath));
				if (!shouldIgnore) results[length++] = fullPath;
			} else results[length++] = fullPath;
		}
		return results;
	} catch {
		return [];
	}
}

/**
 * Recursively retrieves all descendant files and directories under a given
 * directory path.
 *
 * This function performs a breadth-first traversal, returning all nested
 * children (not just immediate ones).
 *
 * @example Const allDescendants = await getDescendantsAsync("./src");
 *
 * @param path - The absolute or relative path to the root directory.
 * @returns An array of absolute paths to all descendant entries. Returns an
 *   empty array if the path is not a directory.
 */
export async function getDescendantsAsync(path: string): Promise<Array<string>> {
	const descendants = await getChildrenAsync(path);
	let totalDescendants = descendants.length;
	let length = 0;

	if (totalDescendants > 0) {
		do {
			const grandChildren = await getChildrenAsync(descendants[length++]!);
			descendants.push(...grandChildren);
			totalDescendants += grandChildren.length;
		} while (length !== totalDescendants);
	}

	return descendants;
}

const BUFFER_EXISTS = typeof Buffer !== "undefined";

/**
 * Converts a value that can be used as a path to its string representation.
 *
 * Accepts strings, URLs, and various typed arrays or buffers, returning a
 * string suitable for Bun file APIs.
 *
 * @example
 *
 * ```typescript
 * toPathString("foo.txt"); // "foo.txt"
 * toPathString(new URL("file:///bar.txt")); // "/bar.txt"
 * toPathString(new Uint8Array([97, 98, 99])); // "abc"
 * ```
 *
 * @param pathLike - The value to convert to a path string. Can be a string,
 *   URL, or supported buffer/typed array.
 * @returns The string representation of the path.
 * @throws {TypeError} If the input type is not supported.
 * @see {@linkcode PathLike}
 */
export function fromPathLike(pathLike: PathLike): string {
	if (typeof pathLike === "string") return pathLike;
	if (pathLike instanceof URL) return pathLike.pathname;
	if (BUFFER_EXISTS && Buffer.isBuffer(pathLike)) return pathLike.toString();

	if (pathLike instanceof ArrayBuffer || ArrayBuffer.isView(pathLike)) {
		const bytes =
			pathLike instanceof ArrayBuffer
				? new Uint8Array(pathLike)
				: new Uint8Array(pathLike.buffer, pathLike.byteOffset, pathLike.byteLength);

		return new TextDecoder().decode(bytes);
	}

	throw new TypeError(`Unsupported path type: ${Object.prototype.toString.call(pathLike)}`);
}

/**
 * Reads a file as an ArrayBuffer.
 *
 * @param pathLike - The path to the file to read.
 * @param contentType - Must be ContentType.ArrayBuffer.
 * @returns The file contents as an ArrayBuffer.
 */
export async function readFileAsync(pathLike: PathLike, contentType: ContentType.ArrayBuffer): Promise<ArrayBuffer>;
/**
 * Reads a file as a byte array (Uint8Array).
 *
 * @param pathLike - The path to the file to read.
 * @param contentType - Must be ContentType.Bytes.
 * @returns The file contents as a Uint8Array.
 */
export async function readFileAsync(pathLike: PathLike, contentType: ContentType.Bytes): Promise<Uint8Array>;
/**
 * Reads a file as FormData.
 *
 * @param pathLike - The path to the file to read.
 * @param contentType - Must be ContentType.FormData.
 * @returns The file contents as FormData.
 */
export async function readFileAsync(pathLike: PathLike, contentType: ContentType.FormData): Promise<FormData>;
/**
 * Reads a file as JSON and validates it with an optional Zod schema.
 *
 * @template T - The expected type of the parsed JSON.
 * @param pathLike - The path to the file to read.
 * @param contentType - Must be ContentType.Json.
 * @param validator - Optional Zod schema for validation.
 * @returns The parsed and validated JSON.
 */
export async function readFileAsync<T = unknown>(
	pathLike: PathLike,
	contentType: ContentType.Json,
	validator?: z.ZodMiniType<T>,
): Promise<T>;
/**
 * Reads a file as JSON (with additional safety, e.g., comments allowed) and
 * validates it with an optional Zod schema.
 *
 * @template T - The expected type of the parsed JSON.
 * @param pathLike - The path to the file to read.
 * @param contentType - Must be ContentType.JsonSafe.
 * @param validator - Optional Zod schema for validation.
 * @returns The parsed and validated JSON.
 */
export async function readFileAsync<T = unknown>(
	pathLike: PathLike,
	contentType: ContentType.JsonSafe,
	validator?: z.ZodMiniType<T>,
): Promise<T>;
/**
 * Reads a file as plain text.
 *
 * @param pathLike - The path to the file to read.
 * @param contentType - Must be ContentType.Text.
 * @returns The file contents as a string.
 */
export async function readFileAsync(pathLike: PathLike, contentType: ContentType.Text): Promise<string>;
/**
 * Reads a file asynchronously and decodes it according to the specified content
 * type.
 *
 * @param pathLike - The path to the file to read.
 * @param contentType - The format in which to decode the file's contents.
 * @param validator - (Optional) Zod validator for JSON/JsonSafe content types.
 * @returns The file contents, decoded as specified by `contentType`.
 * @throws {Error} If the file does not exist or cannot be read.
 */
export async function readFileAsync(
	pathLike: PathLike,
	contentType: ContentType,
	validator?: z.ZodMiniType,
): Promise<unknown> {
	const path = fromPathLike(pathLike);
	const file = Bun.file(path);
	const exists = await file.exists();
	if (!exists) throw new Error(`File does not exist at path: ${path}`);

	switch (contentType) {
		case ContentType.ArrayBuffer: {
			return file.arrayBuffer();
		}

		case ContentType.Bytes: {
			return file.bytes();
		}

		case ContentType.FormData: {
			return file.formData();
		}

		case ContentType.Json: {
			const json: unknown = await file.json();
			if (validator) {
				const result = await validator.safeParseAsync(json);
				if (!result.success) throw fromError(result.error);
				return result.data;
			}
			return json;
		}

		case ContentType.JsonSafe: {
			const json: unknown = await file.text().then(makeJsonSafe).then(JSON.parse);
			if (validator) {
				const result = await validator.safeParseAsync(json);
				if (!result.success) throw fromError(result.error);
				return result.data;
			}
			return json;
		}

		case ContentType.Text: {
			return file.text();
		}

		default: {
			throw new Error(`Unsupported content type: ${contentType}`);
		}
	}
}

/** Options for {@linkcode copyFileAsync}, extending write-file options. */
export interface CopyFileOptions extends WriteFileOptions {}

/**
 * Asynchronously copies a file from source to destination. Creates parent
 * directories if needed; supports mock mode and file mode.
 *
 * @param source - – The source file path.
 * @param destination - – The destination file path.
 * @param copyFileOptions - – Copy options (mockMode, createPath, mode).
 * @returns A promise resolving to the number of bytes written (0 in mock mode).
 */
export async function copyFileAsync(
	source: PathLike,
	destination: PathLike,
	{ createPath = true, mockMode = false, mode }: CopyFileOptions = {},
): Promise<number> {
	const sourcePath = fromPathLike(source);
	const destinationPath = fromPathLike(destination);

	if (createPath) await makeDirectoryAsync(dirname(destinationPath), { mockMode, recursive: true });

	const contents = await readFileAsync(sourcePath, ContentType.Text);
	return writeFileAsync(destinationPath, contents, { mockMode, mode });
}

/** Options for the {@linkcode makeDirectoryAsync} function. */
export interface MakeDirectoryOptions extends WithMockMode {
	/**
	 * A file mode. If a string is passed, it is parsed as an octal integer. If
	 * not specified.
	 *
	 * @default 0o777
	 */
	readonly mode?: Mode;
	/**
	 * Indicates whether parent folders should be created. If a folder was
	 * created, the path to the first created folder will be returned.
	 *
	 * @default false
	 */
	readonly recursive?: boolean;
}

/**
 * Asynchronously creates a directory at the specified path.
 *
 * Supports mock mode for dry-run logging, custom file mode, and recursive
 * creation of parent directories.
 *
 * @example Await makeDirectoryAsync("./output", { recursive: true });
 *
 * @param pathLike - The path to the directory to create. Accepts string, URL,
 *   or array of path segments.
 * @param makeDirectoryOptions - Optional settings for directory creation.
 * @param makeDirectoryOptions.mockMode - If true, logs the intended operation
 *   instead of performing it.
 * @param makeDirectoryOptions.mode - The file mode (permissions) for the new
 *   directory. Defaults to `0o777`.
 * @param makeDirectoryOptions.recursive - If true, creates parent directories
 *   as needed. Defaults to `false`.
 * @returns The path to the first created directory, or `undefined` if in mock
 *   mode.
 */
export async function makeDirectoryAsync(
	pathLike: PathLike,
	makeDirectoryOptions: MakeDirectoryOptions = {},
): Promise<string | undefined> {
	const { mockMode = false, ...options } = makeDirectoryOptions;
	const path = fromPathLike(pathLike);
	if (mockMode) {
		const stringBuilder = [Bun.inspect(path, INSPECT_OPTIONS)];
		if (options) stringBuilder[1] = Bun.inspect(options, INSPECT_OPTIONS);
		logger.info(`mkdir(${stringBuilder.join(", ")})`);
		return undefined;
	}

	return mkdir(path, options);
}

/**
 * Options for the {@linkcode removeFileAsync} function.
 *
 * Provides advanced control over file/directory removal, including filtering,
 * globbing, retry logic, and mock mode.
 *
 * @property backoff - Custom backoff time in ms between retries.
 * @property filter - Optional filter function to select which files/dirs to
 *   remove.
 * @property glob - Enable glob pattern matching or provide glob options.
 * @property maxBackoff - Maximum backoff time in ms.
 * @property maxRetries - Number of retries for transient errors (e.g., EBUSY,
 *   ENOTEMPTY). Ignored if not recursive.
 * @property preserveRoot - If true, prevents deletion of the root directory.
 * @property retryDelay - Time in ms to wait between retries. Ignored if not
 *   recursive.
 * @property signal - Optional abort signal to cancel the operation.
 * @property tmp - Temporary directory to use for intermediate operations.
 * @see {@linkcode rimraf}
 */

/**
 * Options for advanced file/directory removal via {@linkcode removeFileAsync}.
 *
 * Allows fine-grained control over deletion behavior, including filtering,
 * globbing, retry logic, and mock mode.
 *
 * @property backoff - Custom backoff time in milliseconds between retries.
 * @property filter - Optional filter function to select which files or
 *   directories to remove. Can be async.
 * @property glob - Enables glob pattern matching or provides glob options for
 *   selecting files.
 * @property maxBackoff - Maximum backoff time in milliseconds between retries.
 * @property maxRetries - Number of retries for transient errors (e.g., EBUSY,
 *   ENOTEMPTY). Ignored if not recursive. Defaults to `0`.
 * @property preserveRoot - If true, prevents deletion of the root directory.
 * @property retryDelay - Time in milliseconds to wait between retries. Ignored
 *   if not recursive. Defaults to `100`.
 * @property signal - Optional abort signal to cancel the operation.
 * @property tmp - Temporary directory to use for intermediate operations.
 * @see {@linkcode rimraf}
 */
export interface RemoveFileOptions extends WithMockMode {
	/** Custom backoff time in milliseconds between retries. */
	readonly backoff?: number;
	/**
	 * Optional filter function to select which files or directories to remove.
	 * Can be async.
	 *
	 * @param path - The path to the file or directory.
	 * @param ent - The Dirent or Stats object for the entry.
	 * @returns `true` to remove, `false` to skip.
	 */
	readonly filter?:
		| ((path: string, ent: Dirent | Stats) => boolean)
		| ((path: string, ent: Dirent | Stats) => Promise<boolean>);
	/**
	 * Enables glob pattern matching or provides glob options for selecting
	 * files.
	 */
	readonly glob?: boolean | GlobOptions;
	/** Maximum backoff time in milliseconds between retries. */
	readonly maxBackoff?: number;
	/**
	 * Number of retries for transient errors (e.g., EBUSY, ENOTEMPTY). Ignored
	 * if not recursive.
	 *
	 * @default 0
	 */
	readonly maxRetries?: number;
	/** If true, prevents deletion of the root directory. */
	readonly preserveRoot?: boolean;
	/**
	 * Time in milliseconds to wait between retries. Ignored if not recursive.
	 *
	 * @default 100
	 */
	readonly retryDelay?: number;
	/** Optional abort signal to cancel the operation. */
	readonly signal?: AbortSignal;
	/** Temporary directory to use for intermediate operations. */
	readonly tmp?: string;
}

/**
 * Removes files or directories from the file system.
 *
 * Supports mock mode for dry-run logging, advanced filtering, globbing, and
 * retry logic.
 *
 * @example Await removeFileAsync(["foo.txt", "bar.txt"], { mockMode: true });
 *
 * @param pathLike - The path or array of paths to remove. Accepts string, URL,
 *   or supported buffer/typed array.
 * @param removeFileOptions - Optional settings for removal, including mock mode
 *   and advanced options.
 * @returns A promise that resolves to `true` if the operation succeeded, or
 *   `false` otherwise.
 */
export async function removeFileAsync(
	pathLike: Array<PathLike> | PathLike,
	removeFileOptions: RemoveFileOptions = {},
): Promise<boolean> {
	const { mockMode = false, ...options } = removeFileOptions ?? {};
	const pathOrPaths = Array.isArray(pathLike) ? pathLike.map(fromPathLike) : fromPathLike(pathLike);

	if (mockMode) {
		const stringBuilder = [Bun.inspect(pathOrPaths, INSPECT_OPTIONS)];
		if (options) stringBuilder[1] = Bun.inspect(options, INSPECT_OPTIONS);
		logger.info(`rimraf(${stringBuilder.join(", ")})`);
		return true;
	}

	return rimraf(pathOrPaths, options);
}

/**
 * Options for file creation when writing to disk.
 *
 * Controls whether the parent directory should be created if it does not exist,
 * and supports mock mode for dry-run logging.
 *
 * @property createPath - If `true`, creates the parent directory if missing. If
 *   `false`, throws if the directory does not exist. Defaults to `true`.
 * @see {@linkcode writeFileAsync}
 */
export interface WriteFileCreateOptions extends WithMockMode {
	/**
	 * If `true`, create the parent directory if it doesn't exist. By default,
	 * this is `true`.
	 *
	 * If `false`, this will throw an error if the directory doesn't exist.
	 *
	 * @default true
	 */
	readonly createPath?: boolean;
}

/** Options for the {@linkcode writeFileAsync} function. */
export interface WriteFileOptions extends WriteFileCreateOptions {
	/** If writing to a PathLike, set the permissions of the file. */
	readonly mode?: number;
}

/**
 * Use the fastest syscalls available to copy from `content` into `destination`.
 *
 * If `destination` exists, it must be a regular file or symlink to a file. If
 * `destination`'s directory does not exist, it will be created by default.
 *
 * @category File System
 * @param destination - The file or file path to write to.
 * @param content - The data to copy into `destination`.
 * @param writeFileOptions - Options for the write.
 * @returns A promise that resolves with the number of bytes written.
 */
export async function writeFileAsync(
	destination: BunFile | PathLike | S3File,
	content: Array<BlobPart> | ArrayBufferLike | Blob | NodeJS.TypedArray | string,
	writeFileOptions?: WriteFileOptions,
): Promise<number>;
/**
 * Persist a {@linkcode Response} body to disk.
 *
 * @param destination - The file to write to. If the file doesn't exist, it will
 *   be created and if the file does exist, it will be overwritten. If
 *   `content`'s size is less than `destination`'s size, `destination` will be
 *   truncated.
 * @param content - `Response` object.
 * @param writeFileOptions - Options for the write.
 * @returns A promise that resolves with the number of bytes written.
 */
export async function writeFileAsync(
	destination: BunFile,
	content: Response,
	writeFileOptions?: WriteFileCreateOptions,
): Promise<number>;
/**
 * Persist a {@linkcode Response} body to disk.
 *
 * @param destinationPath - The file path to write to. If the file doesn't
 *   exist, it will be created and if the file does exist, it will be
 *   overwritten. If `content`'s size is less than `destination`'s size,
 *   `destination` will be truncated.
 * @param content - `Response` object.
 * @param writeFileOptions - Options for the write.
 * @returns A promise that resolves with the number of bytes written.
 */
export async function writeFileAsync(
	destinationPath: PathLike,
	content: Response,
	writeFileOptions?: WriteFileCreateOptions,
): Promise<number>;
/**
 * Use the fastest syscalls available to copy from `input` into `destination`.
 *
 * If `destination` exists, it must be a regular file or symlink to a file.
 *
 * On Linux, this uses `copy_file_range`.
 *
 * On macOS, when the destination doesn't already exist, this uses
 * [`clonefile()`](https://www.manpagez.com/man/2/clonefile/) and falls back to
 * [`fcopyfile()`](https://www.manpagez.com/man/2/fcopyfile/).
 *
 * @param destination - The file to write to. If the file doesn't exist, it will
 *   be created and if the file does exist, it will be overwritten. If `input`'s
 *   size is less than `destination`'s size, `destination` will be truncated.
 * @param input - The file to copy from.
 * @param writeFileOptions - Options for the write.
 * @returns A promise that resolves with the number of bytes written.
 */
export async function writeFileAsync(
	destination: BunFile,
	input: BunFile,
	writeFileOptions?: WriteFileCreateOptions,
): Promise<number>;
/**
 * Use the fastest syscalls available to copy from `input` into `destination`.
 *
 * If `destination` exists, it must be a regular file or symlink to a file.
 *
 * On Linux, this uses `copy_file_range`.
 *
 * On macOS, when the destination doesn't already exist, this uses
 * [`clonefile()`](https://www.manpagez.com/man/2/clonefile/) and falls back to
 * [`fcopyfile()`](https://www.manpagez.com/man/2/fcopyfile/).
 *
 * @param destinationPath - The file path to write to. If the file doesn't
 *   exist, it will be created and if the file does exist, it will be
 *   overwritten. If `input`'s size is less than `destination`'s size,
 *   `destination` will be truncated.
 * @param input - The file to copy from.
 * @param writeFileOptions - Options for the write.
 * @returns A promise that resolves with the number of bytes written.
 */
export async function writeFileAsync(
	destinationPath: PathLike,
	input: BunFile,
	writeFileOptions?: WriteFileCreateOptions,
): Promise<number>;
/**
 * Writes content to a file asynchronously, supporting various content types and
 * destinations.
 *
 * @example
 *
 * ```typescript
 * await writeFileAsync("foo.txt", "Hello, world!");
 * ```
 *
 * @param destination - The file path, BunFile, or S3File to write to.
 * @param content - The content to write (string, buffer, Blob, Response, etc).
 * @param writeFileOptions - Optional options for writing (e.g., mock mode,
 *   permissions).
 * @returns The number of bytes written (or 0 in mock mode).
 * @throws {TypeError} If the destination or content type is invalid.
 */
export async function writeFileAsync(
	destination: BunFile | PathLike | S3File,
	content: Array<BlobPart> | ArrayBufferLike | Blob | BunFile | NodeJS.TypedArray | Response | string,
	writeFileOptions: WriteFileOptions = {},
): Promise<number> {
	const { mockMode = false, ...options } = writeFileOptions;
	if (mockMode) {
		const stringBuilder = [Bun.inspect(destination, INSPECT_OPTIONS), Bun.inspect(content, INSPECT_OPTIONS)];
		if (options) stringBuilder[2] = Bun.inspect(options, INSPECT_OPTIONS);
		logger.info(`Bun.write(${stringBuilder.join(", ")})`);
		return 0;
	}

	if (content instanceof Response) {
		if (isPathLike(destination)) return Bun.write(destination, content, options);
		if (isBunFile(destination)) return Bun.write(destination, content, options);
		throw new TypeError(`Cannot write Response to ${Object.prototype.toString.call(destination)}`);
	}

	return Bun.write(destination, content, options);
}

/**
 * Returns the file extension (including the leading dot) of a given path.
 *
 * Accepts any value supported by {@linkcode PathLike}, including strings, URLs,
 * and buffers.
 *
 * @example GetExtension("foo/bar.txt"); // ".txt" getExtension("foo/bar"); //
 * ""
 *
 * @param pathLike - The path to extract the extension from.
 * @returns The file extension (e.g., ".txt"), or an empty string if none
 *   exists.
 */
export function getExtension(pathLike: PathLike): string {
	return extname(fromPathLike(pathLike));
}

/**
 * Returns the path string without its file extension.
 *
 * Accepts any value supported by {@linkcode PathLike}, including strings, URLs,
 * and buffers.
 *
 * @example GetPathWithoutExtension("foo/bar.txt"); // "foo/bar"
 * getPathWithoutExtension("foo/bar"); // "foo/bar"
 *
 * @param pathLike - The path to process.
 * @returns The path string with the extension removed. If no extension exists,
 *   returns the original path.
 */
export function getPathWithoutExtension(pathLike: PathLike): string {
	const path = fromPathLike(pathLike);
	const extension = extname(path);
	return extension ? path.slice(0, -extension.length) : path;
}

interface ErrorWithCode extends Error {
	readonly code: string;
}
function isErrorWithCode(value: unknown): value is ErrorWithCode {
	return value instanceof Error && "code" in value && typeof value.code === "string";
}

/**
 * Validates that a path exists and matches the expected file type (directory or
 * file).
 *
 * Throws a TypeError if the path does not exist or does not match the expected
 * type. Optionally logs the error and exits the process if `shouldExit` is
 * true.
 *
 * @example Await validatePathExistsAsync("foo/bar.txt", FileType.File); await
 * validatePathExistsAsync("foo/", FileType.Directory, true);
 *
 * @param pathLike - The path to validate. Accepts any {@linkcode PathLike}
 *   value.
 * @param fileType - The expected type: {@linkcode FileType.Directory} or
 *   {@linkcode FileType.File}.
 * @param shouldExit - If true, logs the error and exits the process on failure.
 *   Defaults to false.
 * @throws {TypeError} If the path does not exist or does not match the expected
 *   type.
 */
export async function validatePathExistsAsync(
	pathLike: PathLike,
	fileType: FileType,
	shouldExit = false,
): Promise<void> {
	const path = fromPathLike(pathLike);

	switch (fileType) {
		case FileType.Directory: {
			let stats: Stats;
			try {
				stats = await stat(path);
			} catch (error: unknown) {
				if (isErrorWithCode(error) && error.code === "ENOENT") {
					const exception = `Expected a directory at ${Bun.inspect(path, INSPECT_OPTIONS)}, but it does not exist.`;
					if (shouldExit) {
						logger.error(exception);
						process.exit(1);
					}
					throw new TypeError(exception);
				}
				throw error;
			}

			if (!stats.isDirectory()) {
				const error = `Expected a directory at ${Bun.inspect(path, INSPECT_OPTIONS)}, but found something else.`;
				if (shouldExit) {
					logger.error(error);
					process.exit(1);
				}
				throw new TypeError(error);
			}

			break;
		}

		case FileType.File: {
			const file = Bun.file(path);
			const exists = await file.exists();
			if (!exists) {
				const error = `Expected a file at ${Bun.inspect(path, INSPECT_OPTIONS)}, but it does not exist.`;
				if (shouldExit) {
					logger.error(error);
					process.exit(1);
				}
				throw new TypeError(error);
			}

			break;
		}

		default: {
			throw new Error(`validatePathExistsAsync: unsupported FileType ${fileType}`);
		}
	}
}

function classify(stats: Stats, path: string): FileType {
	if (stats.isDirectory()) return FileType.Directory;
	if (stats.isFile()) return FileType.File;

	// you could add more branches here for sockets, FIFOs, etc.

	throw new TypeError(`Expected a file or directory at ${Bun.inspect(path, INSPECT_OPTIONS)}, but found neither.`);
}

/**
 * Determines the type of a file system entry (file or directory) at the given
 * path.
 *
 * Follows symbolic links to their target and classifies the result. Throws if
 * the entry is neither a file nor a directory.
 *
 * @example Const type = await getFileTypeAsync("foo/bar.txt"); // FileType.File
 * or FileType.Directory
 *
 * @param pathLike - The path to check. Accepts any {@linkcode PathLike} value.
 * @returns A promise that resolves to the {@linkcode FileType} of the entry.
 * @throws {TypeError} If the entry is neither a file nor a directory, or does
 *   not exist.
 */
export async function getFileTypeAsync(pathLike: PathLike): Promise<FileType> {
	const path = fromPathLike(pathLike);

	const linkStats = await lstat(path);
	if (linkStats.isSymbolicLink()) {
		const targetStats = await stat(path);
		return classify(targetStats, path);
	}

	const stats = await stat(path);
	return classify(stats, path);
}

/**
 * Checks asynchronously whether a given path exists in the file system.
 *
 * @example
 *
 * ```typescript
 * const exists = await doesPathExistAsync("foo.txt");
 * ```
 *
 * @param pathLike - The path to check.
 * @returns `true` if the path exists, `false` if not.
 * @throws {Error} If an unexpected error occurs (other than ENOENT).
 */
export async function doesPathExistAsync(pathLike: PathLike): Promise<boolean> {
	try {
		await stat(fromPathLike(pathLike));
		return true;
	} catch (error: unknown) {
		if (isErrorWithCode(error) && error.code === "ENOENT") return false;
		throw error;
	}
}
