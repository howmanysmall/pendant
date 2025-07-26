/**
 * Enumerates the core Roblox services available for scripting and runtime
 * operations.
 *
 * Each member represents a built-in Roblox service that can be accessed via the
 * Roblox API.
 *
 * @remarks
 * This enum is used for type-safe references to Roblox services in code.
 * @enum {string}
 */
export const enum RobloxService {
	/** Provides chat functionality for players. */
	Chat = "Chat",
	/** Handles haptic feedback operations. */
	HapticService = "HapticService",
	/** Controls lighting and visual effects. */
	Lighting = "Lighting",
	/** Manages localization and language settings. */
	LocalizationService = "LocalizationService",
	/** Represents the collection of player objects. */
	Players = "Players",
	/** The first replicated service loaded for clients. */
	ReplicatedFirst = "ReplicatedFirst",
	/** Shared storage for client-server replication. */
	ReplicatedStorage = "ReplicatedStorage",
	/** Handles game loop and timing operations. */
	RunService = "RunService",
	/** Contains server-side scripts. */
	ServerScriptService = "ServerScriptService",
	/** Storage for server-only objects. */
	ServerStorage = "ServerStorage",
	/** Manages sound playback and audio assets. */
	SoundService = "SoundService",
	/** The main graphical user interface for players. */
	StarterGui = "StarterGui",
	/** Contains starter items for players. */
	StarterPack = "StarterPack",
	/** Contains starter player objects and settings. */
	StarterPlayer = "StarterPlayer",
	/** Contains scripts that run on each player's client. */
	StarterPlayerScripts = "StarterPlayerScripts",
	/** Provides testing utilities and services. */
	TestService = "TestService",
	/** Manages text-based chat functionality. */
	TextChatService = "TextChatService",
	/** The main workspace containing all game objects. */
	Workspace = "Workspace",
}

export default RobloxService;
