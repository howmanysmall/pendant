import crypto from "node:crypto";
import { bunPerformanceNow } from "utilities/performance-utilities";
import type { Logger } from "winston";

import logger from "./logger";

interface LoggerMetadata {
	readonly correlationId?: string;
	readonly ip?: string;
	readonly memoryUsage?: NodeJS.MemoryUsage;
	readonly namespace?: string;
	readonly performance?: {
		readonly duration?: number;
		readonly operationName?: string;
	};
	readonly requestId?: string;
	readonly service?: string;
	readonly userId?: string;
}

const activeProfiles: Record<string, number> = {};

/**
 * Create a child logger with namespace for debug categorization.
 *
 * @param namespace - Namespace tag for logger.
 * @returns A Winston Logger configured with the given namespace.
 */
export function createNamespaceLogger(namespace: string): Logger {
	return logger.child({ namespace });
}

/**
 * Create a child logger with correlation ID for request tracking.
 *
 * @param correlationId - Correlation ID for request tracing.
 * @returns A Winston Logger configured with the given correlation ID.
 */
export function createCorrelatedLogger(correlationId = crypto.randomUUID()): Logger {
	return logger.child({ correlationId });
}

/**
 * Create a child logger with request metadata.
 *
 * @param metadata - Partial request metadata to attach to logs.
 * @returns A Winston Logger enriched with request metadata.
 */
export function createRequestLoggerMetadata(metadata: Partial<LoggerMetadata>): Logger {
	return logger.child(metadata);
}

/**
 * Start a performance timer.
 *
 * @param operationName - Identifier of the profile to start.
 */
export function profileBegin(operationName: string): void {
	activeProfiles[operationName] = bunPerformanceNow();
	logger.debug(`Started profiling: ${operationName}`);
}

/**
 * End a performance timer and log the duration.
 *
 * @param operationName - Identifier of the profile to end.
 * @returns The duration in milliseconds, or undefined if no profile was active.
 */
export function profileEnd(operationName: string): number | undefined {
	const startTime = activeProfiles[operationName];
	if (!startTime) {
		logger.warn(`No active profile found for: ${operationName}`);
		return undefined;
	}

	const duration = bunPerformanceNow() - startTime;
	delete activeProfiles[operationName];

	logger.info(`Profile completed: ${operationName}`, {
		performance: { duration, operationName },
	});

	return duration;
}

/**
 * Log current process memory usage.
 *
 * @param context - Optional context label shown in log message.
 */
export function logMemoryUsage(context?: string): void {
	const memoryUsage = process.memoryUsage();
	const formattedContext = context ? ` - ${context}` : "";

	/**
	 * Format memory values in MB for better readability.
	 *
	 * @param bytes - The memory value in bytes.
	 * @returns The formatted memory string in MB.
	 */
	const formatMemory = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

	logger.info(`Memory usage${formattedContext}`, {
		memoryUsage: {
			arrayBuffers: formatMemory(memoryUsage.arrayBuffers),
			external: formatMemory(memoryUsage.external),
			heapTotal: formatMemory(memoryUsage.heapTotal),
			heapUsed: formatMemory(memoryUsage.heapUsed),
			rss: formatMemory(memoryUsage.rss),
		},
	});
}

/**
 * Force garbage collection if available (for development and debugging).
 *
 * @remarks
 * This requires running with --expose-gc flag.
 */
export function forceGarbageCollection(): void {
	if (typeof global.gc === "function") {
		global.gc();
		logger.debug("Forced garbage collection");
	} else logger.warn("Garbage collection not available (run with --expose-gc)");
}

/**
 * Represents a logger for tracking a single HTTP request lifecycle.
 *
 * @example
 *
 * ```typescript
 * const logger: RequestLogger = ...;
 * logger.logResponse(200, 123);
 * ```
 *
 * @property correlationId - Unique identifier for the request (UUID v4).
 * @property logResponse - Logs the response status and optional timing.
 * @property requestLogger - Logger instance for this request.
 */
export interface RequestLogger {
	/** Unique identifier for the request (UUID v4). */
	readonly correlationId: `${string}-${string}-${string}-${string}-${string}`;
	/** Logs the response status and optional timing. */
	readonly logResponse: (statusCode: number, responseTime?: number) => void;
	/** Logger instance for this request. */
	readonly requestLogger: Logger;
}

/**
 * Parameters describing an incoming HTTP request for logging purposes.
 *
 * @example
 *
 * ```typescript
 * const params: RequestParameters = { method: "GET", url: "/api" };
 * ```
 *
 * @property headers - Optional HTTP headers.
 * @property ip - Optional client IP address.
 * @property method - Optional HTTP method (GET, POST, etc).
 * @property url - Optional request URL.
 * @property userId - Optional user identifier.
 */
export interface RequestParameters {
	/** Optional HTTP headers. */
	readonly headers?: Record<string, unknown>;
	/** Optional client IP address. */
	readonly ip?: string;
	/** Optional HTTP method (GET, POST, etc). */
	readonly method?: string;
	/** Optional request URL. */
	readonly url?: string;
	/** Optional user identifier. */
	readonly userId?: string;
}

/**
 * Create request logging utilities for incoming requests.
 *
 * @param requestParameters - Object containing headers, ip, method, url, and
 *   userId.
 * @returns An object with correlationId, requestLogger, and logResponse
 *   function.
 */
export function createRequestLogger({ headers, ip, method, url, userId }: RequestParameters): RequestLogger {
	const correlationId = crypto.randomUUID();
	const requestLogger = createRequestLoggerMetadata({ correlationId, ip, userId });

	requestLogger.info("Request started", {
		method,
		url,
		userAgent: headers?.["user-agent"],
	});

	return {
		correlationId,
		logResponse: (statusCode: number, responseTime?: number): void => {
			requestLogger.info("Request completed", {
				statusCode,
				...(responseTime && { responseTime }),
			});
		},
		requestLogger,
	};
}
