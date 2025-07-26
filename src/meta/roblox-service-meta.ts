import RobloxService from "./roblox-service";
import RuntimeContext from "./runtime-context";

/**
 * Metadata describing a Roblox service, including its runtime context.
 *
 * @property runtimeContext - The runtime context in which the service operates.
 */
export interface RobloxServiceMetadata {
	/** The runtime context for this service. */
	readonly runtimeContext: RuntimeContext;
}

/**
 * Metadata for all supported Roblox services.
 *
 * @remarks
 * Maps each {@linkcode RobloxService} to its metadata, including runtime
 * context.
 */
export const RobloxServiceMeta: Readonly<Record<RobloxService, RobloxServiceMetadata>> = {
	[RobloxService.Chat]: { runtimeContext: RuntimeContext.Shared },
	[RobloxService.HapticService]: { runtimeContext: RuntimeContext.Shared },
	[RobloxService.Lighting]: { runtimeContext: RuntimeContext.Shared },
	[RobloxService.LocalizationService]: { runtimeContext: RuntimeContext.Shared },
	[RobloxService.Players]: { runtimeContext: RuntimeContext.Shared },
	[RobloxService.ReplicatedFirst]: { runtimeContext: RuntimeContext.Client },
	[RobloxService.ReplicatedStorage]: { runtimeContext: RuntimeContext.Shared },
	[RobloxService.RunService]: { runtimeContext: RuntimeContext.Shared },
	[RobloxService.ServerScriptService]: { runtimeContext: RuntimeContext.Server },
	[RobloxService.ServerStorage]: { runtimeContext: RuntimeContext.Server },
	[RobloxService.SoundService]: { runtimeContext: RuntimeContext.Shared },
	[RobloxService.StarterGui]: { runtimeContext: RuntimeContext.Client },
	[RobloxService.StarterPack]: { runtimeContext: RuntimeContext.Shared },
	[RobloxService.StarterPlayer]: { runtimeContext: RuntimeContext.Shared },
	[RobloxService.TestService]: { runtimeContext: RuntimeContext.Testing },
	[RobloxService.TextChatService]: { runtimeContext: RuntimeContext.Shared },
	[RobloxService.Workspace]: { runtimeContext: RuntimeContext.Shared },
};

export default RobloxServiceMeta;
