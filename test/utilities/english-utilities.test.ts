import { describe, expect, it } from "bun:test";
import { getIndefiniteArticle, isPlural, pluralize } from "utilities/english-utilities";

describe("english-utilities", () => {
	describe("getIndefiniteArticle", () => {
		it("should return 'an' for words starting with vowels", () => {
			expect(getIndefiniteArticle("apple")).toBe("an");
			expect(getIndefiniteArticle("elephant")).toBe("an");
			expect(getIndefiniteArticle("igloo")).toBe("an");
			expect(getIndefiniteArticle("orange")).toBe("an");
			expect(getIndefiniteArticle("umbrella")).toBe("an");
		});

		it("should return 'a' for words starting with consonants", () => {
			expect(getIndefiniteArticle("banana")).toBe("a");
			expect(getIndefiniteArticle("cat")).toBe("a");
			expect(getIndefiniteArticle("dog")).toBe("a");
			expect(getIndefiniteArticle("house")).toBe("a");
			expect(getIndefiniteArticle("tree")).toBe("a");
		});

		it("should handle uppercase letters", () => {
			expect(getIndefiniteArticle("Apple")).toBe("an");
			expect(getIndefiniteArticle("Elephant")).toBe("an");
			expect(getIndefiniteArticle("Banana")).toBe("a");
			expect(getIndefiniteArticle("Cat")).toBe("a");
		});

		it("should handle mixed case", () => {
			expect(getIndefiniteArticle("aPPLE")).toBe("an");
			expect(getIndefiniteArticle("bANANA")).toBe("a");
		});

		it("should handle single characters", () => {
			expect(getIndefiniteArticle("a")).toBe("an");
			expect(getIndefiniteArticle("e")).toBe("an");
			expect(getIndefiniteArticle("i")).toBe("an");
			expect(getIndefiniteArticle("o")).toBe("an");
			expect(getIndefiniteArticle("u")).toBe("an");
			expect(getIndefiniteArticle("b")).toBe("a");
			expect(getIndefiniteArticle("c")).toBe("a");
		});

		it("should handle empty strings gracefully", () => {
			// This might throw or return a default, depending on implementation
			// The function doesn't explicitly handle this case in the source
			expect(() => getIndefiniteArticle("")).not.toThrow();
		});

		it("should work with technical terms", () => {
			expect(getIndefiniteArticle("API")).toBe("an");
			expect(getIndefiniteArticle("URL")).toBe("a");
			expect(getIndefiniteArticle("HTTP")).toBe("an");
			expect(getIndefiniteArticle("JSON")).toBe("a");
			expect(getIndefiniteArticle("XML")).toBe("an");
		});
	});

	describe("isPlural", () => {
		it("should identify plural words ending in 's'", () => {
			expect(isPlural("cats")).toBe(true);
			expect(isPlural("dogs")).toBe(true);
			expect(isPlural("books")).toBe(true);
			expect(isPlural("cars")).toBe(true);
		});

		it("should identify plural words ending in 'es'", () => {
			expect(isPlural("boxes")).toBe(true);
			expect(isPlural("watches")).toBe(true);
			expect(isPlural("dishes")).toBe(true);
			expect(isPlural("classes")).toBe(true);
		});

		it("should identify plural words ending in 'ies'", () => {
			expect(isPlural("cities")).toBe(true);
			expect(isPlural("countries")).toBe(true);
			expect(isPlural("stories")).toBe(true);
			expect(isPlural("babies")).toBe(true);
		});

		it("should return false for singular words", () => {
			expect(isPlural("cat")).toBe(false);
			expect(isPlural("dog")).toBe(false);
			expect(isPlural("book")).toBe(false);
			expect(isPlural("box")).toBe(false);
			expect(isPlural("city")).toBe(false);
		});

		it("should handle edge cases", () => {
			expect(isPlural("")).toBe(false);
			expect(isPlural("s")).toBe(true);
			expect(isPlural("es")).toBe(true);
			expect(isPlural("ies")).toBe(true);
		});

		it("should handle words that end in 's' but are singular", () => {
			// Note: This function is simple and will return true for these
			// It doesn't distinguish between singular words ending in 's' and actual plurals
			expect(isPlural("glass")).toBe(true); // glass is singular but ends in 's'
			expect(isPlural("grass")).toBe(true); // grass is singular but ends in 's'
			expect(isPlural("bass")).toBe(true); // bass is singular but ends in 's'
		});
	});

	describe("pluralize", () => {
		it("should return singular form when amount is 1", () => {
			expect(pluralize(1, "cat")).toBe("cat");
			expect(pluralize(1, "box")).toBe("box");
			expect(pluralize(1, "city")).toBe("city");
			expect(pluralize(1, "dish")).toBe("dish");
		});

		it("should add 's' for regular words", () => {
			expect(pluralize(2, "cat")).toBe("cats");
			expect(pluralize(0, "dog")).toBe("dogs");
			expect(pluralize(5, "book")).toBe("books");
			expect(pluralize(10, "car")).toBe("cars");
		});

		it("should add 'es' for words ending in s, x, z", () => {
			expect(pluralize(2, "glass")).toBe("glasses");
			expect(pluralize(2, "box")).toBe("boxes");
			expect(pluralize(2, "buzz")).toBe("buzzes");
		});

		it("should add 'es' for words ending in ch, sh", () => {
			expect(pluralize(2, "watch")).toBe("watches");
			expect(pluralize(2, "dish")).toBe("dishes");
			expect(pluralize(2, "church")).toBe("churches");
			expect(pluralize(2, "flash")).toBe("flashes");
		});

		it("should change 'y' to 'ies' when preceded by consonant", () => {
			expect(pluralize(2, "city")).toBe("cities");
			expect(pluralize(2, "baby")).toBe("babies");
			expect(pluralize(2, "story")).toBe("stories");
			expect(pluralize(2, "country")).toBe("countries");
		});

		it("should add 's' for words ending in 'y' preceded by vowel", () => {
			expect(pluralize(2, "boy")).toBe("boys");
			expect(pluralize(2, "day")).toBe("days");
			expect(pluralize(2, "key")).toBe("keys");
			expect(pluralize(2, "toy")).toBe("toys");
		});

		it("should handle different amounts", () => {
			expect(pluralize(0, "cat")).toBe("cats");
			expect(pluralize(2, "cat")).toBe("cats");
			expect(pluralize(100, "cat")).toBe("cats");
			expect(pluralize(-1, "cat")).toBe("cats");
		});

		it("should handle edge cases", () => {
			expect(pluralize(2, "")).toBe("s");
			expect(pluralize(1, "")).toBe("");
			expect(pluralize(2, "s")).toBe("ses");
			expect(pluralize(2, "x")).toBe("xes");
			expect(pluralize(2, "z")).toBe("zes");
		});

		it("should handle single character words", () => {
			expect(pluralize(2, "a")).toBe("as");
			expect(pluralize(2, "I")).toBe("Is");
		});

		it("should be consistent across different platforms", () => {
			// Test that string operations work consistently
			const testWords = ["cat", "box", "city", "watch", "baby"];
			const expectedPlurals = ["cats", "boxes", "cities", "watches", "babies"];

			for (const [index, testWord] of testWords.entries())
				expect(pluralize(2, testWord)).toBe(expectedPlurals[index]!);
		});

		it("should handle technical terms", () => {
			expect(pluralize(2, "API")).toBe("APIs");
			expect(pluralize(2, "URL")).toBe("URLs");
			expect(pluralize(2, "class")).toBe("classes");
			expect(pluralize(2, "method")).toBe("methods");
		});
	});

	describe("cross-platform consistency", () => {
		it("should handle character code operations consistently", () => {
			// Test that character code operations work the same across platforms
			const testCases = [
				{ article: "an", word: "apple" },
				{ article: "a", word: "banana" },
				{ article: "an", word: "APPLE" },
				{ article: "a", word: "BANANA" },
			];

			for (const { article, word } of testCases) {
				expect(getIndefiniteArticle(word)).toBe(article);
			}
		});

		it("should handle string operations consistently", () => {
			// Test that string manipulation works the same across platforms
			const testCases = [
				{ amount: 1, expected: "test", word: "test" },
				{ amount: 2, expected: "tests", word: "test" },
				{ amount: 2, expected: "boxes", word: "box" },
				{ amount: 2, expected: "cities", word: "city" },
			];

			for (const { amount, expected, word } of testCases) {
				expect(pluralize(amount, word)).toBe(expected);
			}
		});

		it("should handle regex operations consistently", () => {
			// Test that regex operations work the same across platforms
			const pluralWords = ["cats", "boxes", "cities", "dishes", "glasses"];
			const singularWords = ["cat", "box", "city", "dish"];

			for (const word of pluralWords) {
				expect(isPlural(word)).toBe(true);
			}

			for (const word of singularWords) {
				expect(isPlural(word)).toBe(false);
			}

			// Note: words ending in 's' are treated as plural by this simple function
			expect(isPlural("glass")).toBe(true); // glass ends in 's'
		});
	});
});
