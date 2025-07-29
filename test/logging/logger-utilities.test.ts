import { beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
	createCorrelatedLogger,
	createNamespaceLogger,
	createRequestLogger,
	createRequestLoggerMetadata,
	logMemoryUsage,
	profileBegin,
	profileEnd,
	type RequestParameters,
} from "logging/logger-utilities";
import crypto from "node:crypto";

describe("logger-utilities", () => {
	describe("createNamespaceLogger", () => {
		it("should create logger with namespace", () => {
			const logger = createNamespaceLogger("test-namespace");

			expect(logger).toBeDefined();
			expect(typeof logger.info).toBe("function");
			expect(typeof logger.error).toBe("function");
			expect(typeof logger.warn).toBe("function");
			expect(typeof logger.debug).toBe("function");
		});

		it("should work with different namespaces", () => {
			const logger1 = createNamespaceLogger("namespace-1");
			const logger2 = createNamespaceLogger("namespace-2");

			expect(logger1).toBeDefined();
			expect(logger2).toBeDefined();
		});
	});

	describe("createCorrelatedLogger", () => {
		it("should create logger with generated correlation ID", () => {
			const logger = createCorrelatedLogger();

			expect(logger).toBeDefined();
			expect(typeof logger.info).toBe("function");
		});

		it("should create logger with provided correlation ID", () => {
			const correlationId = crypto.randomUUID();
			const logger = createCorrelatedLogger(correlationId);

			expect(logger).toBeDefined();
			expect(typeof logger.info).toBe("function");
		});

		it("should use crypto.randomUUID when no ID provided", () => {
			const mockUUID = spyOn(crypto, "randomUUID").mockReturnValue(
				"test-uuid" as unknown as `${string}-${string}-${string}-${string}-${string}`,
			);

			const logger = createCorrelatedLogger();

			expect(logger).toBeDefined();
			expect(mockUUID).toHaveBeenCalled();

			mockUUID.mockRestore();
		});
	});

	describe("createRequestLoggerMetadata", () => {
		it("should create logger with metadata", () => {
			const metadata = {
				correlationId: "test-correlation-id",
				ip: "127.0.0.1",
				service: "test-service",
				userId: "user-123",
			};

			const logger = createRequestLoggerMetadata(metadata);

			expect(logger).toBeDefined();
			expect(typeof logger.info).toBe("function");
		});

		it("should work with empty metadata", () => {
			const logger = createRequestLoggerMetadata({});

			expect(logger).toBeDefined();
		});

		it("should work with partial metadata", () => {
			const logger = createRequestLoggerMetadata({
				namespace: "test-namespace",
			});

			expect(logger).toBeDefined();
		});
	});

	describe("performance profiling", () => {
		beforeEach(() => {
			// Clear any existing profiles
			// Note: We can't directly access activeProfiles, so we'll test behavior
		});

		it("should start and end profiling", () => {
			const operationName = "test-operation";

			profileBegin(operationName);

			// Small delay to ensure measurable duration
			const start = Date.now();
			while (Date.now() - start < 1) {
				// Busy wait for 1ms
			}

			const duration = profileEnd(operationName);

			expect(duration).toBeDefined();
			expect(typeof duration).toBe("number");
			expect(duration).toBeGreaterThanOrEqual(0);
		});

		it("should handle ending non-existent profile", () => {
			const duration = profileEnd("non-existent-operation");

			expect(duration).toBeUndefined();
		});

		it("should handle multiple concurrent profiles", () => {
			const operation1 = "operation-1";
			const operation2 = "operation-2";

			profileBegin(operation1);
			profileBegin(operation2);

			const duration1 = profileEnd(operation1);
			const duration2 = profileEnd(operation2);

			expect(duration1).toBeDefined();
			expect(duration2).toBeDefined();
			expect(typeof duration1).toBe("number");
			expect(typeof duration2).toBe("number");
		});

		it("should not allow ending same profile twice", () => {
			const operationName = "single-operation";

			profileBegin(operationName);
			const duration1 = profileEnd(operationName);
			const duration2 = profileEnd(operationName);

			expect(duration1).toBeDefined();
			expect(duration2).toBeUndefined();
		});
	});

	describe("logMemoryUsage", () => {
		it("should log memory usage without context", () => {
			// This function logs to winston, so we just ensure it doesn't throw
			expect(() => {
				logMemoryUsage();
			}).not.toThrow();
		});

		it("should log memory usage with context", () => {
			expect(() => {
				logMemoryUsage("test-context");
			}).not.toThrow();
		});

		it("should work with various context strings", () => {
			expect(() => {
				logMemoryUsage("startup");
			}).not.toThrow();
			expect(() => {
				logMemoryUsage("after-operation");
			}).not.toThrow();
			expect(() => {
				logMemoryUsage("");
			}).not.toThrow();
		});
	});

	describe("createRequestLogger", () => {
		it("should create request logger with all parameters", () => {
			const requestParameters: RequestParameters = {
				headers: {
					"content-type": "application/json",
					"user-agent": "test-agent",
				},
				ip: "192.168.1.1",
				method: "GET",
				url: "/api/test",
				userId: "user-123",
			};

			const requestLogger = createRequestLogger(requestParameters);

			expect(requestLogger).toBeDefined();
			expect(requestLogger.correlationId).toBeDefined();
			expect(typeof requestLogger.correlationId).toBe("string");
			expect(requestLogger.requestLogger).toBeDefined();
			expect(typeof requestLogger.logResponse).toBe("function");
		});

		it("should create request logger with minimal parameters", () => {
			const requestParameters: RequestParameters = {};

			const requestLogger = createRequestLogger(requestParameters);

			expect(requestLogger).toBeDefined();
			expect(requestLogger.correlationId).toBeDefined();
			expect(requestLogger.requestLogger).toBeDefined();
			expect(typeof requestLogger.logResponse).toBe("function");
		});

		it("should generate UUID format correlation ID", () => {
			const requestLogger = createRequestLogger({});

			// UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
			expect(requestLogger.correlationId).toMatch(
				/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
			);
		});

		it("should handle logResponse without responseTime", () => {
			const requestLogger = createRequestLogger({});

			expect(() => {
				requestLogger.logResponse(200);
			}).not.toThrow();
		});

		it("should handle logResponse with responseTime", () => {
			const requestLogger = createRequestLogger({});

			expect(() => {
				requestLogger.logResponse(200, 150);
			}).not.toThrow();
		});

		it("should handle different status codes", () => {
			const requestLogger = createRequestLogger({});

			expect(() => {
				requestLogger.logResponse(200);
			}).not.toThrow();
			expect(() => {
				requestLogger.logResponse(404);
			}).not.toThrow();
			expect(() => {
				requestLogger.logResponse(500);
			}).not.toThrow();
		});

		it("should work with complex headers", () => {
			const requestParameters: RequestParameters = {
				headers: {
					accept: "application/json",
					authorization: "Bearer token123",
					"user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
					"x-custom-header": "custom-value",
				},
				method: "POST",
				url: "/api/users",
			};

			const requestLogger = createRequestLogger(requestParameters);

			expect(requestLogger).toBeDefined();
			expect(() => {
				requestLogger.logResponse(201, 89);
			}).not.toThrow();
		});
	});

	describe("cross-platform compatibility", () => {
		it("should work with crypto.randomUUID on all platforms", () => {
			// Test that UUID generation works across platforms
			const uuid1 = crypto.randomUUID();
			const uuid2 = crypto.randomUUID();

			expect(uuid1).not.toBe(uuid2);
			expect(typeof uuid1).toBe("string");
			expect(typeof uuid2).toBe("string");
		});

		it("should handle memory usage tracking on all platforms", () => {
			// process.memoryUsage() should work on all Node.js platforms
			expect(() => {
				const memUsage = process.memoryUsage();

				expect(memUsage).toBeDefined();
				expect(typeof memUsage.rss).toBe("number");
				expect(typeof memUsage.heapUsed).toBe("number");
			}).not.toThrow();
		});

		it("should work with performance timing on all platforms", () => {
			// Test that performance timing works consistently
			profileBegin("cross-platform-test");

			// Simulate some work
			let _sum = 0;
			for (let index = 0; index < 1000; index += 1) _sum += index;

			const duration = profileEnd("cross-platform-test");

			expect(duration).toBeDefined();
			expect(typeof duration).toBe("number");
			expect(duration).toBeGreaterThanOrEqual(0);
		});
	});
});
