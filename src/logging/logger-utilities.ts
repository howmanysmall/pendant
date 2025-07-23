import crypto from "node:crypto";
import type { Logger } from "winston";

import { bunPerformanceNow } from "../utilities/performance-utilities";
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
	logger.info(`Memory usage${formattedContext}`, { memoryUsage });
}

export interface RequestLogger {
	readonly correlationId: `${string}-${string}-${string}-${string}-${string}`;
	readonly logResponse: (statusCode: number, responseTime?: number) => void;
	readonly requestLogger: Logger;
}
export interface RequestParameters {
	readonly headers?: Record<string, unknown>;
	readonly ip?: string;
	readonly method?: string;
	readonly url?: string;
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
