const UINT32_MAX = 0x1_0000_0000;

/** The {@linkcode UniqueRandom} data type generates pseudorandom numbers. */
export default class UniqueRandom {
	/**
	 * Returns a new Random object with the same state as the original.
	 *
	 * @returns A new {@linkcode UniqueRandom} object with the same state as the
	 *   original.
	 */
	public clone(): UniqueRandom {
		const clone = Object.create(UniqueRandom.prototype) as UniqueRandom;
		clone.state = this.state;
		return clone;
	}

	/**
	 * Returns a pseudorandom integer uniformly distributed over
	 * [{@linkcode minimum}, {@linkcode maximum}].
	 *
	 * @param minimum - The minimum value (inclusive) of the range. If not
	 *   provided, the default is `0`.
	 * @param maximum - The maximum value (inclusive) of the range. If not
	 *   provided, the default is `4294967295` (the maximum value of a 32-bit
	 *   unsigned integer).
	 * @returns A pseudorandom integer within the specified range.
	 */
	public nextInteger(minimum: number, maximum: number): number {
		if (!Number.isInteger(minimum) || !Number.isInteger(maximum)) {
			const error = new TypeError("Bounds must be integers");
			Error.captureStackTrace(error, UniqueRandom.prototype.nextInteger);
			throw error;
		}

		if (maximum < minimum) {
			const error = new RangeError("maximum must be ≥ minimum");
			Error.captureStackTrace(error, UniqueRandom.prototype.nextInteger);
			throw error;
		}

		const range = maximum - minimum + 1;
		const value = this.nextUInt32();

		// if full 32‑bit span, return value directly.
		// Otherwise, scale via modulus — bias is negligible for JS doubles.
		return range === UINT32_MAX ? value : minimum + (value % range);
	}

	/** Returns a pseudorandom number uniformly distributed over `[0, 1]`. */
	public nextNumber(): number;
	/**
	 * Returns a pseudorandom number uniformly distributed over
	 * [{@linkcode minimum}, {@linkcode maximum}].
	 *
	 * @param minimum
	 * @param maximum
	 */
	public nextNumber(minimum: number, maximum: number): number;
	public nextNumber(minimum?: number, maximum?: number): number {
		const base = this.nextUInt32() / UINT32_MAX;
		if (minimum === undefined && maximum === undefined) return base;

		if (minimum === undefined || maximum === undefined) {
			const error = new TypeError("Supply both bounds or neither for nextNumber()");
			Error.captureStackTrace(error, UniqueRandom.prototype.nextNumber);
			throw error;
		}
		if (maximum < minimum) {
			const error = new RangeError("maximum must be ≥ minimum");
			Error.captureStackTrace(error, UniqueRandom.prototype.nextNumber);
			throw error;
		}
		return minimum + (maximum - minimum) * base;
	}

	/**
	 * Uniformly shuffles the array in-place using {@linkcode nextInteger} to
	 * pick indices. If there are any "holes" in the array, {@linkcode shuffle}
	 * throws an error, since shuffling could change the length.
	 *
	 * The shuffle is defined to be a Fisher-Yates shuffle so the number of
	 * {@linkcode nextInteger} calls is guaranteed to be consistent between
	 * engine versions for a given size of array.
	 *
	 * @param array - The array to shuffle. If the array is sparse, an error is
	 *   thrown.
	 */
	public shuffle(array: Array<unknown>): void {
		const { length } = array;
		for (let index = 0; index < length; ++index)
			if (!(index in array)) {
				const error = new TypeError("Cannot shuffle sparse arrays");
				Error.captureStackTrace(error, UniqueRandom.prototype.shuffle);
				throw error;
			}

		for (let index = length - 1; index > 0; --index) {
			const jndex = this.nextInteger(0, index);
			[array[index], array[jndex]] = [array[jndex], array[index]];
		}
	}

	/**
	 * Returns a new {@linkcode UniqueRandom} object. If you don't provide the
	 * seed parameter, {@linkcode UniqueRandom} uses a seed from an internal
	 * entropy source.
	 *
	 * If you provide a seed, it should be within the range `[-9007199254740991,
	 * 9007199254740991]`, and {@linkcode UniqueRandom} will round it down to the
	 * nearest integer. So seeds of `0`, `0.99`, and `Math.random()` all produce
	 * identical generators.
	 *
	 * @param seed - The seed to use for the random number generator. If not
	 *   provided, a seed is generated from an internal entropy source.
	 */
	public constructor(seed?: number) {
		if (seed === undefined) seed = (Date.now() ^ Math.floor(Math.random() * UINT32_MAX)) >>> 0;
		else {
			if (!Number.isFinite(seed) || seed < -9007199254740991 || seed > 9007199254740991) {
				const error = new RangeError("Seed out of range");
				Error.captureStackTrace(error, UniqueRandom.prototype.constructor);
				throw error;
			}

			seed = Math.floor(seed) >>> 0;
		}

		this.state = seed ^ 0x6d2b79f5;
	}

	private state: number;
	private nextUInt32(): number {
		const state = this.state + 0x6d2b79f5;
		this.state = state;

		let value = state >>> 0;
		value = Math.imul(value ^ (value >>> 15), value | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return (value ^ (value >>> 14)) >>> 0;
	}
}
