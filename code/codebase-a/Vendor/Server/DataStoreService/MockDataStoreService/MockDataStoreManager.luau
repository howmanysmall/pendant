--[[
	MockDataStoreManager.lua
	This module does bookkeeping of data, interfaces and request limits used by MockDataStoreService and its sub-classes.

	This module is licensed under APLv2, refer to the LICENSE file or:
	https://github.com/buildthomas/MockDataStoreService/blob/master/LICENSE
]]

local HttpService = game:GetService("HttpService") -- for json encode/decode
local Players = game:GetService("Players") -- for restoring budgets
local RunService = game:GetService("RunService") -- for checking if running context is on server

local Constants = require(script.Parent.MockDataStoreConstants)
local Utils = require(script.Parent.MockDataStoreUtils)

local MockDataStoreManager = {}

local ConstantsMapping = {
	[Enum.DataStoreRequestType.GetAsync] = Constants.BUDGET_GETASYNC;
	[Enum.DataStoreRequestType.GetSortedAsync] = Constants.BUDGET_GETSORTEDASYNC;
	[Enum.DataStoreRequestType.OnUpdate] = Constants.BUDGET_ONUPDATE;
	[Enum.DataStoreRequestType.SetIncrementAsync] = Constants.BUDGET_SETINCREMENTASYNC;
	[Enum.DataStoreRequestType.SetIncrementSortedAsync] = Constants.BUDGET_SETINCREMENTSORTEDASYNC;
}

-- Bookkeeping of all data:
local Data = {
	GlobalDataStore = {};
	DataStore = {};
	OrderedDataStore = {};
}

-- Bookkeeping of all active GlobalDataStore/OrderedDataStore interfaces indexed by data table:
local Interfaces = {}

-- Request limit bookkeeping:
local Budgets = {}

local budgetRequestQueues = {
	[Enum.DataStoreRequestType.GetAsync] = {};
	[Enum.DataStoreRequestType.GetSortedAsync] = {};
	[Enum.DataStoreRequestType.OnUpdate] = {};
	[Enum.DataStoreRequestType.SetIncrementAsync] = {};
	[Enum.DataStoreRequestType.SetIncrementSortedAsync] = {};
}

local function initBudget()
	for requestType, const in next, ConstantsMapping do
		Budgets[requestType] = const.START
	end

	Budgets[Enum.DataStoreRequestType.UpdateAsync] =
		math.min(Budgets[Enum.DataStoreRequestType.GetAsync], Budgets[Enum.DataStoreRequestType.SetIncrementAsync])
end

local function updateBudget(req, const, dt, n)
	if not Constants.BUDGETING_ENABLED then
		return
	end

	local rate = const.RATE + n * const.RATE_PLR
	Budgets[req] = math.min(Budgets[req] + dt * rate, const.MAX_FACTOR * rate)
end

local function stealBudget(budget)
	if not Constants.BUDGETING_ENABLED then
		return
	end

	for _, requestType in next, budget do
		if Budgets[requestType] then
			Budgets[requestType] = math.max(0, Budgets[requestType] - 1)
		end
	end

	Budgets[Enum.DataStoreRequestType.UpdateAsync] =
		math.min(Budgets[Enum.DataStoreRequestType.GetAsync], Budgets[Enum.DataStoreRequestType.SetIncrementAsync])
end

local function checkBudget(budget)
	if not Constants.BUDGETING_ENABLED then
		return true
	end

	for _, requestType in next, budget do
		if Budgets[requestType] and Budgets[requestType] < 1 then
			return false
		end
	end

	return true
end

local isFrozen = false

if RunService:IsServer() then
	-- Only do budget/throttle updating on server (in case package required on client)
	initBudget()

	coroutine.wrap(function() -- Thread that increases budgets and de-throttles requests periodically
		local lastCheck = os.clock()
		while Utils.accurateWait(Constants.BUDGET_UPDATE_INTERVAL) do
			local now = os.clock()
			local dt = (now - lastCheck) / 60
			lastCheck = now
			local n = #Players:GetPlayers()

			if not isFrozen then
				for requestType, const in next, ConstantsMapping do
					updateBudget(requestType, const, dt, n)
				end

				Budgets[Enum.DataStoreRequestType.UpdateAsync] = math.min(
					Budgets[Enum.DataStoreRequestType.GetAsync],
					Budgets[Enum.DataStoreRequestType.SetIncrementAsync]
				)
			end

			for _, budgetRequestQueue in next, budgetRequestQueues do
				for i = #budgetRequestQueue, 1, -1 do
					local request = budgetRequestQueue[i]

					local thread = request.Thread
					local budget = request.Budget
					local key = request.Key
					local lock = request.Lock
					local cache = request.Cache

					if
						not (lock and (lock[key] or os.clock() - (cache[key] or 0) < Constants.WRITE_COOLDOWN))
						and checkBudget(budget)
					then
						table.remove(budgetRequestQueue, i)
						stealBudget(budget)
						coroutine.resume(thread)
					end
				end
			end
		end
	end)()

	game:BindToClose(function()
		for requestType, const in next, ConstantsMapping do
			Budgets[requestType] =
				math.max(Budgets[requestType], Constants.BUDGET_ONCLOSE_BASE * (const.RATE / Constants.BUDGET_BASE))
		end

		Budgets[Enum.DataStoreRequestType.UpdateAsync] =
			math.min(Budgets[Enum.DataStoreRequestType.GetAsync], Budgets[Enum.DataStoreRequestType.SetIncrementAsync])
	end)
end

function MockDataStoreManager.GetGlobalData()
	return Data.GlobalDataStore
end

function MockDataStoreManager.GetData(name, scope)
	assert(type(name) == "string")
	assert(type(scope) == "string")

	if not Data.DataStore[name] then
		Data.DataStore[name] = {}
	end

	if not Data.DataStore[name][scope] then
		Data.DataStore[name][scope] = {}
	end

	return Data.DataStore[name][scope]
end

function MockDataStoreManager.GetOrderedData(name, scope)
	assert(type(name) == "string")
	assert(type(scope) == "string")

	if not Data.OrderedDataStore[name] then
		Data.OrderedDataStore[name] = {}
	end

	if not Data.OrderedDataStore[name][scope] then
		Data.OrderedDataStore[name][scope] = {}
	end

	return Data.OrderedDataStore[name][scope]
end

function MockDataStoreManager.GetDataInterface(data)
	return Interfaces[data]
end

function MockDataStoreManager.SetDataInterface(data, interface)
	assert(type(data) == "table")
	assert(type(interface) == "table")

	Interfaces[data] = interface
end

function MockDataStoreManager.GetBudget(requestType)
	if Constants.BUDGETING_ENABLED then
		return math.floor(Budgets[requestType] or 0)
	else
		return math.huge
	end
end

function MockDataStoreManager.SetBudget(requestType, budget)
	assert(type(budget) == "number")
	budget = math.max(budget, 0)

	if requestType == Enum.DataStoreRequestType.UpdateAsync then
		Budgets[Enum.DataStoreRequestType.SetIncrementAsync] = budget
		Budgets[Enum.DataStoreRequestType.GetAsync] = budget
	end

	if Budgets[requestType] then
		Budgets[requestType] = budget
	end
end

MockDataStoreManager.ResetBudget = initBudget
function MockDataStoreManager.FreezeBudgetUpdates()
	isFrozen = true
end

function MockDataStoreManager.ThawBudgetUpdates()
	isFrozen = false
end

function MockDataStoreManager.YieldForWriteLockAndBudget(callback, key, writeLock, writeCache, budget)
	assert(type(callback) == "function")
	assert(type(key) == "string")
	assert(type(writeLock) == "table")
	assert(type(writeCache) == "table")
	assert(#budget > 0)

	local mainRequestType = budget[1]
	if #budgetRequestQueues[mainRequestType] >= Constants.THROTTLE_QUEUE_SIZE then
		return false -- no room in throttle queue
	end

	callback() -- would i.e. trigger a warning in output
	table.insert(budgetRequestQueues[mainRequestType], 1, {
		Key = key;
		Lock = writeLock;
		Cache = writeCache;
		Thread = coroutine.running();
		Budget = budget;
	})

	coroutine.yield()
	return true
end

function MockDataStoreManager.YieldForBudget(callback, budget)
	assert(type(callback) == "function")
	assert(#budget > 0)

	local mainRequestType = budget[1]

	if checkBudget(budget) then
		stealBudget(budget)
	elseif #budgetRequestQueues[mainRequestType] >= Constants.THROTTLE_QUEUE_SIZE then
		return false -- no room in throttle queue
	else
		callback() -- would i.e. trigger a warning in output
		table.insert(budgetRequestQueues[mainRequestType], 1, {
			After = 0; -- no write lock
			Thread = coroutine.running();
			Budget = budget;
		})

		coroutine.yield()
	end

	return true
end

function MockDataStoreManager.ExportToJSON()
	local export = {}
	if next(Data.GlobalDataStore) ~= nil then -- GlobalDataStore not empty
		export.GlobalDataStore = Data.GlobalDataStore
	end

	export.DataStore = Utils.prepareDataStoresForExport(Data.DataStore) -- can be nil
	export.OrderedDataStore = Utils.prepareDataStoresForExport(Data.OrderedDataStore) -- can be nil

	return HttpService:JSONEncode(export)
end

-- Import into an entire datastore type:
local function importDataStoresFromTable(origin, destination, warnFunc, methodName, prefix, isOrdered)
	for name, scopes in next, origin do
		if type(name) ~= "string" then
			warnFunc(
				string.format(
					"%s: ignored %s > %q (name is not a string, but a %s)",
					methodName,
					prefix,
					tostring(name),
					typeof(name)
				)
			)
		elseif type(scopes) ~= "table" then
			warnFunc(
				string.format(
					"%s: ignored %s > %q (scope list is not a table, but a %s)",
					methodName,
					prefix,
					name,
					typeof(scopes)
				)
			)
		elseif #name == 0 then
			warnFunc(string.format("%s: ignored %s > %q (name is an empty string)", methodName, prefix, name))
		elseif #name > Constants.MAX_LENGTH_NAME then
			warnFunc(
				string.format(
					"%s: ignored %s > %q (name exceeds %d character limit)",
					methodName,
					prefix,
					name,
					Constants.MAX_LENGTH_NAME
				)
			)
		else
			for scope, data in next, scopes do
				if type(scope) ~= "string" then
					warnFunc(
						string.format(
							"%s: ignored %s > %q > %q (scope is not a string, but a %s)",
							methodName,
							prefix,
							name,
							tostring(scope),
							typeof(scope)
						)
					)
				elseif type(data) ~= "table" then
					warnFunc(
						string.format(
							"%s: ignored %s > %q > %q (data list is not a table, but a %s)",
							methodName,
							prefix,
							name,
							scope,
							typeof(data)
						)
					)
				elseif #scope == 0 then
					warnFunc(
						string.format(
							"%s: ignored %s > %q > %q (scope is an empty string)",
							methodName,
							prefix,
							name,
							scope
						)
					)
				elseif #scope > Constants.MAX_LENGTH_SCOPE then
					warnFunc(
						string.format(
							"%s: ignored %s > %q > %q (scope exceeds %d character limit)",
							methodName,
							prefix,
							name,
							scope,
							Constants.MAX_LENGTH_SCOPE
						)
					)
				else
					if not destination[name] then
						destination[name] = {}
					end

					if not destination[name][scope] then
						destination[name][scope] = {}
					end

					Utils.importPairsFromTable(
						data,
						destination[name][scope],
						Interfaces[destination[name][scope]],
						warnFunc,
						methodName,
						string.format("%s > %q > %q", prefix, name, scope),
						isOrdered
					)
				end
			end
		end
	end
end

function MockDataStoreManager.ImportFromJSON(content, verbose)
	assert(type(content) == "table")
	assert(verbose == nil or type(verbose) == "boolean")

	local warnFunc = warn -- assume verbose as default
	if verbose == false then -- intentional formatting
		warnFunc = function() end
	end

	if type(content.GlobalDataStore) == "table" then
		Utils.importPairsFromTable(
			content.GlobalDataStore,
			Data.GlobalDataStore,
			Interfaces[Data.GlobalDataStore],
			warnFunc,
			"ImportFromJSON",
			"GlobalDataStore",
			false
		)
	end

	if type(content.DataStore) == "table" then
		importDataStoresFromTable(content.DataStore, Data.DataStore, warnFunc, "ImportFromJSON", "DataStore", false)
	end

	if type(content.OrderedDataStore) == "table" then
		importDataStoresFromTable(
			content.OrderedDataStore,
			Data.OrderedDataStore,
			warnFunc,
			"ImportFromJSON",
			"OrderedDataStore",
			true
		)
	end
end

function MockDataStoreManager.ResetData()
	for _, interface in next, Interfaces do
		for key in next, interface.__data do
			interface.__data[key] = nil
			interface.__event:Fire(key, nil)
		end

		interface.__getCache = {}
		interface.__writeCache = {}
		interface.__writeLock = {}
		if interface.__sorted then
			interface.__sorted = {}
			interface.__ref = {}
			interface.__changed = false
		end
	end

	table.clear(Data.GlobalDataStore)

	for _, scopes in next, Data.DataStore do
		for _, data in next, scopes do
			table.clear(data)
		end
	end

	for _, scopes in next, Data.OrderedDataStore do
		for _, data in next, scopes do
			table.clear(data)
		end
	end
end

return MockDataStoreManager
