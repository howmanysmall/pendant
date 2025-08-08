// @ts-check

import style, { GLOB_JSON, GLOB_JSONC, GLOB_MARKDOWN_CODE } from "@isentinel/eslint-config";

import perfectionist from "eslint-plugin-perfectionist";

export default style(
	{
		formatters: {
			css: true,
			graphql: true,
			html: true,
			lua: false,
			markdown: true,
			prettierOptions: {
				arrowParens: "always",
				bracketSameLine: false,
				bracketSpacing: true,
				checkIgnorePragma: false,
				embeddedLanguageFormatting: "auto",
				endOfLine: "auto",
				experimentalOperatorPosition: "end",
				experimentalTernaries: false,
				filepath: undefined,
				htmlWhitespaceSensitivity: "css",
				insertPragma: false,
				jsxSingleQuote: false,
				objectWrap: "preserve",
				printWidth: 120,
				proseWrap: "preserve",
				quoteProps: "as-needed",
				requirePragma: false,
				semi: true,
				singleQuote: false,
				tabWidth: 4,
				trailingComma: "all",
				useTabs: true,
				vueIndentScriptAndStyle: false,
			},
		},
		gitignore: false,
		ignores: [".lune/**", "do-not-sync-ever/**", "./data/**", "node_modules/**", GLOB_MARKDOWN_CODE],
		markdown: true,
		perfectionist: {
			customClassGroups: [],
		},
		plugins: {
			perfectionist,
		},
		pnpm: false,
		react: true,
		roblox: false,
		rules: {
			// this is stupid? and standard?
			"antfu/no-top-level-await": "off",
			"arrow-style/arrow-return-style": "off",
			curly: "off",

			"id-length": [
				"error",
				{
					max: 45,
				},
			],
			// makes shit less neat
			"no-inline-comments": "off",
			"no-restricted-syntax": "off",
			"perfectionist/sort-classes": [
				"warn",
				{
					groups: [
						"static-property",
						"static-method",
						"property",
						["get-method", "set-method"],
						"method",
						"constructor",

						// ← pull private instance fields out here:
						"private-property",

						// ← then the big nested bucket (minus "private-property")
						[
							// Static protected
							"protected-static-property",
							"protected-static-accessor-property",
							"protected-static-get-method",
							"protected-static-set-method",
							"protected-static-method",

							// Static private methods & accessors
							"private-static-accessor-property",
							"private-static-get-method",
							"private-static-set-method",
							"private-static-method",

							// Instance protected
							"protected-property",
							"protected-accessor-property",
							"protected-get-method",
							"protected-set-method",
							"protected-method",

							// Instance private methods & accessors
							"private-accessor-property",
							"private-get-method",
							"private-set-method",
							"private-method",
						],
					],
					order: "asc",
				},
			],
			"perfectionist/sort-objects": [
				"warn",
				{
					customGroups: {
						id: "^id$",
						name: "^name$",
						callbacks: ["\b(on[A-Z][a-zA-Z]*)\b"],
						reactProps: ["^children$", "^ref$"],
					},
					groups: ["id", "name", "unknown", "reactProps"],
					order: "asc",
					partitionByComment: "^Part:\\*\\*(.*)$",
					type: "natural",
				},
			],
			// some things are just not correct in pascal case unfortunately
			"shopify/typescript-prefer-pascal-case-enums": "off",
			// the most annoying thing known to man
			"sonar/cognitive-complexity": "off",
			"sonar/no-nested-incdec": "off",
			// ugly and makes max-lines-per-function even worse
			"style/padding-line-between-statements": "off",
			"test/require-hook": "off",
			"ts/explicit-member-accessibility": [
				"error",
				{
					accessibility: "explicit",
				},
			],
			// kid named "no operation"
			"ts/no-empty-function": "off",
			// sometimes stuff isn't added. this is unhelpful as a result.
			"ts/no-empty-object-type": "off",
			// sometimes I know shit exists, get over it
			"ts/no-non-null-assertion": "off",
			// borderline useless
			"ts/no-unnecessary-condition": "off",
			// worthless lint. always incorrect.
			"ts/no-unsafe-argument": "off",
			// worthless lint. always incorrect.
			"ts/no-unsafe-assignment": "off",
			// worthless lint. always incorrect.
			"ts/no-unsafe-call": "off",
			// worthless lint. always incorrect.
			"ts/no-unsafe-member-access": "off",
			// worthless lint. always incorrect.
			"ts/no-unsafe-return": "off",
			// rule conflict
			"ts/strict-boolean-expressions": "off",
			// world's most useless rule: does not care if you have a `default:`
			"ts/switch-exhaustiveness-check": "off",
			"ts/unbound-method": "off",
			// no it shouldn't lol
			"unicorn/catch-error-name": [
				"error",
				{
					name: "error",
				},
			],
			"unicorn/consistent-destructuring": "off",
			// this is just outright annoying
			"unicorn/no-keyword-prefix": "off",
			"unicorn/no-useless-undefined": ["error", { checkArguments: false, checkArrowFunctionBody: false }],
		},
		spellCheck: false,
		stylistic: {
			indent: "tab",
			jsx: true,
			quotes: "double",
			semi: true,
		},
		test: true,
		toml: false,
		type: "game",
		typescript: {
			parserOptions: {
				allowDefaultProject: true,
			},
		},
		yaml: {
			overrides: {
				"yaml/indent": "error",
				"yaml/no-tab-indent": "error",
			},
		},
	},
	{
		files: [GLOB_JSON, GLOB_JSONC, "src/**/*.ts", "test/**/*.ts"],
		rules: {
			// highly annoying
			"max-lines": "off",
			"max-lines-per-function": "off",
			"sonar/max-lines": "off",
		},
	},
	{
		files: ["test/**/*.ts"],
		rules: {
			"id-length": "off",
			"test/require-hook": "off",
		},
	},
	{
		files: [".lune/**", "do-not-sync-ever/**", "./data/**", "node_modules/**"],
		rules: { "*": "off" },
	},
	{
		files: ["benchmarks/**/*.ts", "scripts/**/*.ts"],
		rules: {},
	},
	{
		files: ["tsconfig.json"],
		rules: {
			"jsonc/comma-dangle": "off",
		},
	},
);
