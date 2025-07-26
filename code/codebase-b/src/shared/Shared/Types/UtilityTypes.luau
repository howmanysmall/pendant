--!optimize 2

export type Result<T, E> = {
	Error: E,
	Success: false,
} | {
	Success: true,
	Value: T,
}

return false
