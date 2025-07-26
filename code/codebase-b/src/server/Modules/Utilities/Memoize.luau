--!optimize 2

export type MemoizeFunction<T, U> = (index: T) -> U
export type Memoized<T, U> = typeof(setmetatable(
	{} :: {[T]: U},
	{} :: {
		__call: (self: any, index: T) -> U,
		__index: (self: any, index: T) -> U,
	}
))

local function Memoize<T, U>(callback: MemoizeFunction<T, U>): Memoized<T, U>
	local metatable = {}
	function metatable:__call(index: T): U
		return self[index]
	end

	function metatable:__index(index: T): U
		local value = callback(index)
		self[index] = value
		return value
	end

	return setmetatable({}, metatable)
end

return Memoize
