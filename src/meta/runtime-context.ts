/**
 * Specifies the runtime context for code execution in Roblox environments.
 *
 * Used to distinguish between client, server, shared, and testing execution
 * contexts.
 *
 * @remarks
 * This enum is used for context-aware logic and code branching.
 */
export const enum RuntimeContext {
	/** Code running on the client (e.g., player device). */
	Client = "Client",
	/** Code running on the server. */
	Server = "Server",
	/** Code shared between client and server. */
	Shared = "Shared",
	/** Code used for testing. */
	Testing = "Testing",
	/** Code running in an unknown context. */
	Unknown = "Unknown",
}

export default RuntimeContext;
