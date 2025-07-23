/** Clean, modern logging utility for build scripts. */

export const enum LogLevel {
	Debug = 0,
	Info = 1,
	Success = 2,
	Warn = 3,
	Error = 4,
}

export interface LogOptions {
	readonly bold?: boolean;
	readonly dim?: boolean;
	readonly noFormat?: boolean;
}

const COLORS = {
	bold: "\x1b[1m",
	cyan: "\x1b[36m",
	dim: "\x1b[2m",
	gray: "\x1b[90m",
	green: "\x1b[32m",
	red: "\x1b[31m",
	reset: "\x1b[0m",
	yellow: "\x1b[33m",
} as const;

const ICONS: Record<LogLevel, string> = {
	[LogLevel.Debug]: "•",
	[LogLevel.Error]: "✗",
	[LogLevel.Info]: "ℹ",
	[LogLevel.Success]: "✓",
	[LogLevel.Warn]: "⚠",
} as const;

function getColorForLevel(level: LogLevel): string {
	if (level === LogLevel.Info) return COLORS.cyan;
	if (level === LogLevel.Success) return COLORS.green;
	if (level === LogLevel.Warn) return COLORS.yellow;
	if (level === LogLevel.Error) return COLORS.red;
	return COLORS.gray;
}

function formatMessage(level: LogLevel, message: string, options: LogOptions = {}): string {
	const icon = ICONS[level];
	if (options.noFormat) return `${icon} ${message}`;

	const color = getColorForLevel(level);
	// eslint-disable-next-line sonar/no-nested-conditional -- don't care
	const style = options.bold ? COLORS.bold : options.dim ? COLORS.dim : "";

	return `${color}${style}${icon} ${message}${COLORS.reset}`;
}

const consoleLog = console.log;
const consoleError = console.error;
const consoleDebug = console.debug;
const consoleWarn = console.warn;

export function info(message: string, options?: LogOptions): void {
	consoleLog(formatMessage(LogLevel.Info, message, options));
}

export function success(message: string, options?: LogOptions): void {
	consoleLog(formatMessage(LogLevel.Success, message, options));
}

export function warn(message: string, options?: LogOptions): void {
	consoleWarn(formatMessage(LogLevel.Warn, message, options));
}

export function error(message: string, options?: LogOptions): void {
	consoleError(formatMessage(LogLevel.Error, message, options));
}

export function debug(message: string, options?: LogOptions): void {
	consoleDebug(formatMessage(LogLevel.Debug, message, options));
}

export function plain(message: string, options: LogOptions & { color?: keyof typeof COLORS } = {}): void {
	const { bold, color, dim } = options;
	const colorCode = color ? COLORS[color] : "";
	// eslint-disable-next-line sonar/no-nested-conditional -- don't care
	const style = bold ? COLORS.bold : dim ? COLORS.dim : "";

	consoleLog(`${colorCode}${style}${message}${COLORS.reset}`);
}

export default {
	debug,
	error,
	info,
	plain,
	success,
	warn,
};
