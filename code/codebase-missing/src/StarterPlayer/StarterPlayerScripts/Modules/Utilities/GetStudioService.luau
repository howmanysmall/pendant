--!optimize 2
--!strict

local studioService: StudioService?
local function Get(): StudioService
	return game:GetService("StudioService")
end

local function GetStudioService(): StudioService?
	if studioService then
		return studioService
	end

	local success, value = pcall(Get)
	if success then
		studioService = value
	end

	return if success then value else nil
end

return GetStudioService
