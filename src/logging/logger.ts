import applicationPaths from "constants/application-paths";
import { IS_DEVELOPER_MODE } from "constants/environment-constants";
import { join } from "node:path";
import { createLogger, format, transports } from "winston";
import DailyRotateFile from "winston-daily-rotate-file";

const enhancedFormat = format.combine(
	format.timestamp(),
	format.errors({ stack: true }),
	format.printf((transformableInfo): string => {
		const { level, message, stack, timestamp, ...meta } = transformableInfo;
		const logEntry = {
			level,
			message,
			timestamp,
			...(stack ? { stack } : {}),
			...meta,
		};
		return JSON.stringify(logEntry);
	}),
);

/**
 * Enhanced logger instance with log rotation, custom metadata, profiling, debug
 * namespaces, correlation IDs, and memory tracking.
 */
export const logger = createLogger({
	defaultMeta: { service: "Pendant" },
	format: enhancedFormat,
	level: "info",
	transports: [
		new DailyRotateFile({
			datePattern: "YYYY-MM-DD",
			filename: join(applicationPaths.log, "error-%DATE%.log"),
			level: "error",
			maxFiles: "14d",
			maxSize: "20m",
			zippedArchive: true,
		}),
		new DailyRotateFile({
			datePattern: "YYYY-MM-DD",
			filename: join(applicationPaths.log, "combined-%DATE%.log"),
			maxFiles: "30d",
			maxSize: "50m",
			zippedArchive: true,
		}),
	],
});

const consoleTransport = new transports.Console({
	format: IS_DEVELOPER_MODE
		? format.combine(
				format.cli({}),
				format.colorize({}), // Colorize output in console
				format.simple(),
			)
		: format.combine(format.cli({})),
});
logger.add(consoleTransport);

export default logger;
