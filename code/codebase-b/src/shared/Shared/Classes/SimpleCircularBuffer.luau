--!native
--!optimize 2
--!strict

type DataMethod = (method: "Data") -> {number}
type ClearMethod = (method: "Clear") -> ()
type PushMethod = (method: "Push", value: number) -> ()
export type SimpleCircularBuffer = DataMethod & ClearMethod & PushMethod

local function SimpleCircularBuffer(maxCapacity: number): SimpleCircularBuffer
	local data = table.create(maxCapacity)

	local function methods(method: "Data" | "Push" | "Clear", value: unknown): unknown
		if method == "Data" then
			return data
		end

		if method == "Push" then
			table.insert(data, 1, value)
			if #data > maxCapacity then
				table.remove(data)
			end
			return
		end

		if method == "Clear" then
			table.clear(data)
			return
		end

		error(`Unknown method {method}`)
	end

	return methods
end

return SimpleCircularBuffer
