import RobloxService from "./roblox-service";
import RuntimeContext from "./runtime-context";

export interface Metadata {
	readonly runtimeContext: RuntimeContext;
}

export const RobloxServiceMeta: Readonly<Record<RobloxService, Metadata>> = {
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
