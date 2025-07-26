--!optimize 2

local Players = game:GetService("Players")
local GetStudioService = require(script.Parent.GetStudioService)

local userId: string? = nil

local function GetLocalPlayerUserId(): number
	if userId then
		return userId
	end

	local localPlayer = Players.LocalPlayer
	if localPlayer then
		local localUserId = localPlayer.UserId
		userId = localUserId
		return localUserId
	end

	local studioService = GetStudioService()
	if studioService then
		local localUserId = studioService:GetUserId()
		userId = localUserId
		return localUserId
	end

	return 0
end

return GetLocalPlayerUserId
