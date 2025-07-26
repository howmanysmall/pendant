#!/usr/bin/env bun

import { barplot, bench, run } from "mitata";
import { prettyJsonStringify } from "utilities/json-utilities";

import prettyJsonEncodeOld from "./utilities/pretty-json-stringify-old";

const testData = {
	config: {
		api: {
			baseUrl: "https://api.example.com",
			retries: 3,
			timeout: 5000,
		},
		features: {
			authentication: true,
			caching: false,
			logging: true,
		},
	},
	metadata: {
		created: new Date().toISOString(),
		stats: {
			activeUsers: 50,
			metrics: Array.from({ length: 20 }, (_, index) => ({
				name: `metric_${index}`,
				timestamp: Date.now() - index * 60000,
				value: Math.random() * 1000,
			})),
			totalUsers: 100,
		},
		version: "1.2.3",
	},
	users: Array.from({ length: 100 }, (_, index) => ({
		id: index + 1,
		name: `User ${index + 1}`,
		email: `user${index + 1}@example.com`,
		profile: {
			active: index % 2 === 0,
			age: 20 + (index % 50),
			settings: {
				notifications: true,
				preferences: {
					features: ["feature1", "feature2", "feature3"],
					language: "en",
					timezone: "UTC",
				},
				theme: index % 3 === 0 ? "dark" : "light",
			},
			tags: [`tag${index % 5}`, `category${index % 3}`],
		},
	})),
};

barplot(() => {
	bench("old version", () => {
		prettyJsonEncodeOld(testData);
	});
	bench("new version", () => {
		prettyJsonStringify(testData);
	});
});

await run({});
