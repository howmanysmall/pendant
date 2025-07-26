const ALL_LETTERS = "abcdefghijklmnopqrstuvwxyz";

function asByteSet(characters: string, includeAllCases: boolean): Set<number> {
	const byteSet = new Set<number>();

	if (includeAllCases)
		for (const character of characters) {
			byteSet.add(character.toLocaleLowerCase().charCodeAt(0));
			byteSet.add(character.toLocaleUpperCase().charCodeAt(0));
		}
	else for (const character of characters) byteSet.add(character.charCodeAt(0));

	return byteSet;
}

const ENGLISH_VOWELS = asByteSet("aeiou", true);
const ENGLISH_CONSONANTS = asByteSet(
	ALL_LETTERS.split("")
		.filter((character) => !ENGLISH_VOWELS.has(character.charCodeAt(0)))
		.join(""),
	true,
);

/**
 * An indefinite article is a word that introduces a noun without specifying
 * which one. In English, the indefinite articles are "a" and "an".
 */
export type IndefiniteArticle = "a" | "an";

const INDEFINITE_ARTICLE_LOOKUP: Record<string, IndefiniteArticle> = {
	api: "an",
	http: "an",
	json: "a",
	url: "a",
	xml: "an",
};

/**
 * Returns the correct indefinite article ("a" or "an") for a given English
 * word.
 *
 * The function checks the first character of the word and determines if it is a
 * vowel.
 *
 * @example
 *
 * ```typescript
 * getIndefiniteArticle("apple"); // "an"
 * getIndefiniteArticle("banana"); // "a"
 * ```
 *
 * @param value - The word to evaluate.
 * @returns An if the word starts with a vowel, otherwise "a".
 */
export function getIndefiniteArticle(value: string): string {
	const specialCase = INDEFINITE_ARTICLE_LOOKUP[value.toLocaleLowerCase()];
	if (specialCase !== undefined) return specialCase;
	return ENGLISH_VOWELS.has(value.charCodeAt(0)) ? "an" : "a";
}

const IS_PLURAL_REGEX = /ies$|es$|s$/;

/**
 * Determines if a given English word is plural based on its ending.
 *
 * @example
 *
 * ```typescript
 * isPlural("apples"); // true
 * isPlural("apple"); // false
 * ```
 *
 * @param value - The word to check.
 * @returns `true` if the word ends with "ies", "es", or "s"; otherwise `false`.
 */
export function isPlural(value: string): boolean {
	return IS_PLURAL_REGEX.test(value);
}

/**
 * Returns the plural form of an English word based on the given amount.
 *
 * Handles common pluralization rules for English nouns, including special
 * endings for pronunciation and words ending in "y" preceded by a consonant.
 *
 * @remarks
 * This function does not handle irregular plurals (e.g., "child" ->
 * "children").
 * @example
 *
 * ```typescript
 * pluralize(1, "apple"); // "apple"
 * pluralize(2, "apple"); // "apples"
 * pluralize(2, "box"); // "boxes"
 * pluralize(2, "city"); // "cities"
 * ```
 *
 * @param amount - The quantity to determine singular or plural form.
 * @param word - The word to pluralize.
 * @returns The pluralized word if `amount` is not 1; otherwise, the original
 *   word.
 */
export function pluralize(amount: number, word: string): string {
	if (amount === 1) return word;

	const { length } = word;
	const lastByte = word.charCodeAt(length - 1);
	if (lastByte === 115 || lastByte === 120 || lastByte === 122) return `${word}es`;

	const secondToLastByte = word.charCodeAt(length - 2);
	if ((secondToLastByte === 99 || secondToLastByte === 115) && lastByte === 104) return `${word}es`;
	if (lastByte === 121 && ENGLISH_CONSONANTS.has(secondToLastByte)) return `${word.slice(0, -1)}ies`;
	// irregular plurals are cringe
	return `${word}s`;
}
