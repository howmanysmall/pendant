# Pendant TypeScript Style Guide

# Introduction

This style guide establishes the coding conventions for TypeScript code developed in the Pendant project. It builds upon modern TypeScript and Bun best practices while incorporating specific organizational requirements and preferences. The guide prioritizes code readability, maintainability, consistency, and performance across all project components.

# Key Principles

* **Readability First:** Code should be immediately understandable to all team members without extensive context switching.
* **Type Safety:** Leverage TypeScript's full type system to catch errors at compile time rather than runtime.
* **Consistency:** Uniform coding patterns reduce cognitive load and improve collaboration efficiency.
* **Performance Conscious:** Write efficient code while maintaining clarity and correctness.
* **Modern Standards:** Embrace current TypeScript, Bun, and React patterns while avoiding deprecated approaches.
* **Documentation as Code:** Every public interface must be thoroughly documented with JSDoc.

# Runtime and Platform Standards

This project uses **Bun** as the primary JavaScript runtime, not Node.js. All tooling, scripts, and runtime decisions should favor Bun-native APIs and capabilities.

## Bun Usage Requirements

* Use `bun <file>` instead of `node <file>` or `ts-node <file>`
* Use `bun test` instead of `jest` or `vitest`
* Use `bun build <file>` instead of `webpack` or `esbuild`
* Use `bun install` instead of `npm install`, `yarn install`, or `pnpm install`
* Use `bun run <script>` instead of `npm run <script>` or equivalent package manager commands
* Environment variables are automatically loaded from `.env` filesdo not use `dotenv`

## Preferred Bun APIs

Replace Node.js APIs with Bun equivalents whenever possible:

* Use `Bun.serve()` for HTTP servers instead of `express` or Node's `http`/`https`
* Use `bun:sqlite` for SQLite instead of `better-sqlite3`
* Use `Bun.file()` for file operations instead of `node:fs` methods
* Use `Bun.spawn()` for child processes instead of `child_process`
* Use `Bun.env` for environment variables instead of `process.env`
* Use `Bun.fetch()` for HTTP requests instead of `node-fetch` or `axios`
* Use built-in `WebSocket` instead of the `ws` library
* Use `Bun.$\`command\`` for shell commands instead of `execa`

## Development Workflow

* Use `bun --hot` for development with hot-reload capabilities
* Use `bunx tsc --noEmit` for type checking without output generation
* Leverage `bun build --compile --target=<platform>` for standalone executables
* Configure project settings in `bunfig.toml` rather than separate config files

## Testing Standards

* Use `bun test` as the primary test runner
* Write tests in `*.test.ts` files co-located with source code
* Import test utilities from `bun:test`: `import { test, expect } from "bun:test"`
* Configure test settings in the `[test]` section of `bunfig.toml`
* Use `bun test --hot` for continuous testing during development

```typescript
import { test, expect } from "bun:test";

test("should calculate sum correctly", () => {
  expect(add(2, 3)).toBe(5);
});
```

# TypeScript Conventions

## Core Language Standards

* **Never use `any` type:** Prefer specific types, `unknown`, or `never` when necessary
* **Always use ESM imports/exports:** Avoid CommonJS patterns entirely
* **Explicit return types:** All exported functions must have explicit return type annotations
* **Strict compiler options:** Enable all strict mode flags in `tsconfig.json`
* **No abbreviations:** Use full words—write `properties` not `props`, `reference` not `ref`

## Type Definitions

* Use `type` for type aliases and `interface` for object shapes
* Use `enum` sparingly—prefer union types or const assertions
* Use `import type` for type-only imports to optimize bundle size
* Use `export type` for type-only exports
* Prefer `export default` for primary module exports

## Variable and Function Naming

* **Functions:** `camelCase` format (e.g., `calculateTotalAsync`)
* **Variables:** `camelCase` format (e.g., `userAccountData`)
* **Constants:** `SCREAMING_SNAKE_CASE` format (e.g., `MAX_RETRY_ATTEMPTS`)
* **Types/Interfaces:** `PascalCase` format (e.g., `UserAccountData`)
* **Files:** `kebab-case` format (e.g., `user-account-utilities.ts`)
* **Async functions:** Must end with `Async` suffix (e.g., `fetchUserDataAsync`)

## Array and Collection Types

* Use `Array<T>` syntax instead of `T[]` for consistency
* Use `ReadonlyArray<T>` for immutable arrays
* Use `ReadonlyMap<K, V>` and `ReadonlySet<T>` for immutable collections
* Use `Readonly<Record<K, V>>` for immutable object maps

## Advanced TypeScript Patterns

* **Branded types:** Use for domain-specific string/number types
  ```typescript
  type UserId = string & { __brand: "UserId" };
  ```
* **Satisfies operator:** Validate object literals against interfaces without type widening
  ```typescript
  const config = {
    host: "localhost",
    port: 8080,
  } satisfies ServerConfig;
  ```
* **Template literal types:** Model string patterns in the type system
  ```typescript
  type Hex = `0x${string}`;
  type EventName = `on${Capitalize<string>}`;
  ```
* **Assertion functions:** Combine runtime validation with compile-time narrowing
  ```typescript
  function assertUser(value: unknown): asserts value is User {
    if (!isUser(value)) throw new Error("Invalid user object");
  }
  ```

## Error Handling

* **Never use `null`:** Use `undefined` for optional values
* **Catch with `unknown`:** Enable `useUnknownInCatchVariables` in tsconfig
* **Type guards:** Write explicit type guard functions for runtime checks
* **Exhaustive switches:** Use `assertNever` in default cases for discriminated unions
  ```typescript
  function assertNever(value: never): never {
    throw new Error(`Unhandled case: ${value}`);
  }
  ```

## Import Organization

Group imports into logical sections separated by blank lines, in this order:

1. **External modules** (third-party packages)
2. **Path aliases** (configured in tsconfig paths)
3. **Relative imports** (local files)

```typescript
// External modules
import { z } from "zod";
import type { ReactNode } from "react";

// Path aliases
import type { Logger } from "~/logging/logger";
import { createUtility } from "~/utilities/factory";

// Relative imports
import { validateInput } from "./validation";
import type { LocalConfig } from "./types";
```

## Code Style and Formatting

* **Single-line blocks:** Omit braces for single-line conditional blocks
  ```typescript
  if (condition) doSomething();
  ```
* **Optional chaining:** Use `?.` and `??` instead of manual existence checks
* **Immutability:** Prefer `readonly` properties and `const` assertions
* **No console methods:** Use the logger library instead of `console.*`
* **Class modifiers:** Always declare visibility modifiers on class members

## Utility Types and Patterns

Leverage TypeScript's utility types for safer code evolution:

* `Partial<T>`, `Required<T>`, `Pick<T, K>`, `Omit<T, K>` for object manipulation
* `Record<K, V>` for dictionary-like objects
* `ReturnType<T>`, `Parameters<T>` for extracting function signatures
* `NonNullable<T>` for removing null/undefined from union types

```typescript
// Extract configuration type from function parameters
type ConfigOptions = Parameters<typeof createServer>[0];

// Create a partial update type
type UserUpdate = Partial<Pick<User, "name" | "email">>;
```

# React Component Standards

## Component Structure

* **Functional components only:** No class components
* **TypeScript interfaces:** Define properties with explicit interfaces
* **Export defaults:** Prefer default exports for primary components
* **Single responsibility:** One component per file, focused on one concern
* **Maximum 100 lines:** Keep components under 100 lines when possible

## Component Properties

* **Interface naming:** Use `ComponentNameProperties` format
* **Readonly properties:** Mark all properties as `readonly`
* **Full word properties:** Write `properties` not `props`, `reference` not `ref`
* **JSDoc documentation:** Document the interface and each property

```typescript
/**
 * Properties for the UserCard component.
 */
export interface UserCardProperties {
  /** The user data to display. */
  readonly user: User;
  /** Optional click handler for card interaction. */
  readonly onCardClick?: (userId: string) => void;
  /** Additional CSS classes to apply. */
  readonly className?: string;
}

/**
 * Displays user information in a card format.
 *
 * @param properties - The component properties.
 * @returns A card element displaying user information.
 */
export default function UserCard(properties: UserCardProperties): ReactNode {
  const { user, onCardClick, className } = properties;

  const handleClick = (): void => {
    onCardClick?.(user.id);
  };

  return (
    <div className={className} onClick={handleClick}>
      <h3>{user.name}</h3>
      <p>{user.email}</p>
    </div>
  );
}
```

## Hook Guidelines

* **Custom hooks:** Extract reusable logic into custom hooks
* **Named functions:** No anonymous functions in `useEffect` callbacks
* **Cleanup functions:** Always return cleanup functions in `useEffect`
* **Dependency arrays:** Include all dependencies in effect arrays
* **Hook naming:** Use `use` prefix and descriptive names

```typescript
/**
 * A hook for managing toggle state.
 *
 * @param initialState - The initial boolean state.
 * @returns An object containing the current state and toggle function.
 */
export function useToggle(initialState: boolean): {
  readonly isToggled: boolean;
  readonly toggle: () => void;
} {
  const [isToggled, setIsToggled] = useState(initialState);

  const toggle = useCallback((): void => {
    setIsToggled(previous => !previous);
  }, []);

  return { isToggled, toggle };
}
```

## Performance Optimization

* **React.memo:** Wrap components that receive stable properties
* **useMemo:** Memoize expensive calculations
* **useCallback:** Memoize event handlers passed to child components
* **Key properties:** Always provide stable, unique keys for list items
* **Code splitting:** Use `React.lazy` and `Suspense` for large components

# Project Organization and File Structure

## Directory Structure

Organize code by feature or domain rather than by file type. The current project follows this pattern:

```
src/
├── commands/          # CLI command implementations
├── constants/         # Application-wide constants
├── core/             # Core business logic and orchestration
├── logging/          # Logging utilities and configuration
├── meta/             # Metadata and type definitions
├── utilities/        # Reusable utility functions
└── index.ts          # Application entry point
```

## File Naming Conventions

* **All files:** Use `kebab-case` format (e.g., `user-account-utilities.ts`)
* **Test files:** Co-locate with source files using `.test.ts` suffix
* **Type files:** Use `.types.ts` suffix for pure type definition files
* **Configuration files:** Use descriptive names ending in `-config.ts`

## Module Exports

* **Primary exports:** Use `export default` for the main module export
* **Named exports:** Use named exports for utilities, types, and secondary functions
* **Barrel exports:** Create `index.ts` files to re-export from subdirectories when appropriate
* **Type-only exports:** Use `export type` for interfaces and type aliases

```typescript
// utilities/validation-utilities.ts
export default function validateUserInput(input: string): boolean {
  return input.length > 0;
}

export type ValidationResult = {
  readonly isValid: boolean;
  readonly errors: ReadonlyArray<string>;
};

export function createValidator(rules: ValidationRules): Validator {
  // implementation
}
```

## Directory-Specific Guidelines

### Commands Directory (`src/commands/`)
* CLI command implementations using a consistent framework
* Each command in its own file
* Commands should be focused and single-purpose
* Include comprehensive JSDoc for command descriptions and examples

### Constants Directory (`src/constants/`)
* Application-wide constants grouped by domain
* Use `SCREAMING_SNAKE_CASE` for constant names
* Export constants as named exports, not default exports
* Include JSDoc explaining the purpose and valid values

### Core Directory (`src/core/`)
* Business logic and application orchestration
* Coordination between different system components
* Complex workflows and process management
* High-level abstractions that don't fit in utilities

### Meta Directory (`src/meta/`)
* Type definitions and metadata
* Schema definitions and validation
* Runtime type information
* API contracts and interfaces

### Utilities Directory (`src/utilities/`)
* Pure functions and utility classes
* Reusable code that can be used across the application
* Domain-specific utilities grouped by functionality
* Each utility file should have a clear, specific purpose

# Documentation Standards

## JSDoc Requirements

Every exported element must have comprehensive JSDoc documentation following these standards:

### Functions and Methods

```typescript
/**
 * Calculates the total cost including tax and shipping.
 *
 * This function applies the appropriate tax rate based on the shipping
 * address and adds standard shipping costs unless overnight delivery
 * is selected.
 *
 * @param items - Array of items to calculate cost for.
 * @param shippingAddress - The delivery address for tax calculation.
 * @param options - Additional calculation options.
 * @returns An object containing the itemized cost breakdown.
 *
 * @example
 * ```typescript
 * const total = calculateTotal(cartItems, userAddress, {
 *   overnightShipping: true,
 *   promoCode: "SAVE10"
 * });
 * console.log(total.grandTotal);
 * ```
 *
 * @throws {ValidationError} When items array is empty.
 * @throws {AddressError} When shipping address is invalid.
 */
export function calculateTotal(
  items: ReadonlyArray<CartItem>,
  shippingAddress: Address,
  options: CalculationOptions = {}
): CostBreakdown {
  // implementation
}
```

### Interfaces and Types

```typescript
/**
 * Configuration options for the user authentication system.
 *
 * This interface defines all the settings that can be customized
 * for how user authentication and session management behaves.
 */
export interface AuthenticationConfig {
  /** The maximum session duration in milliseconds. */
  readonly sessionTimeout: number;

  /** Whether to require email verification for new accounts. */
  readonly requireEmailVerification: boolean;

  /** The number of failed login attempts before account lockout. */
  readonly maxLoginAttempts: number;
}
```

### Classes

```typescript
/**
 * Manages user authentication and session lifecycle.
 *
 * This class handles login/logout operations, session validation,
 * and user credential management. It integrates with external
 * identity providers and maintains secure session state.
 *
 * @example
 * ```typescript
 * const auth = new AuthenticationManager({
 *   sessionTimeout: 3600000,
 *   requireEmailVerification: true
 * });
 *
 * const session = await auth.loginAsync("user@example.com", "password");
 * ```
 */
export class AuthenticationManager {
  /**
   * Creates a new authentication manager instance.
   *
   * @param config - Configuration options for authentication behavior.
   */
  public constructor(config: AuthenticationConfig) {
    // implementation
  }
}
```

### React Components

```typescript
/**
 * Properties for the UserProfile component.
 */
export interface UserProfileProperties {
  /** The user data to display in the profile. */
  readonly user: User;

  /** Whether the profile can be edited by the current user. */
  readonly isEditable: boolean;

  /** Callback fired when user data is updated. */
  readonly onUserUpdate?: (updatedUser: User) => void;
}

/**
 * Displays and optionally allows editing of user profile information.
 *
 * This component shows user details including name, email, avatar,
 * and other profile fields. When editable, it provides form controls
 * for updating user information with validation and error handling.
 *
 * @param properties - The component properties.
 * @returns A user profile display and editing interface.
 *
 * @example
 * ```tsx
 * <UserProfile
 *   user={currentUser}
 *   isEditable={true}
 *   onUserUpdate={handleUserUpdate}
 * />
 * ```
 */
export default function UserProfile(
  properties: UserProfileProperties
): ReactNode {
  // implementation
}
```

## Documentation Quality Standards

* **Clarity:** Write in clear, simple language avoiding jargon
* **Completeness:** Document all parameters, return values, and exceptions
* **Examples:** Provide practical usage examples for complex functions
* **Context:** Explain why something exists, not just what it does
* **Maintenance:** Keep documentation updated when code changes

# Tooling and Configuration

## Biome Configuration

The project uses Biome for linting and formatting. Key configuration settings:

### Formatting Standards
* **Indentation:** Tab characters with 4-space width
* **Line width:** 120 characters maximum
* **Quote style:** Double quotes for strings and JSX attributes
* **Semicolons:** Always required
* **Trailing commas:** Always include in multiline constructs
* **Arrow parentheses:** Always wrap arrow function parameters in parentheses

### File Naming Enforcement
* **Kebab-case required:** All filenames must use kebab-case format
* **ASCII characters only:** No Unicode characters in filenames

### Console Usage Restrictions
The project enforces strict logging standards through custom Biome plugins:
* `console.log`, `console.error`, `console.warn`, `console.info`, `console.debug`, and `console.trace` are prohibited
* Use the logger library instead of console methods for all output

### Linting Rules

**Complexity Rules:**
* Arrow functions preferred over function expressions where appropriate
* `Date.now()` preferred over `new Date().getTime()`
* Array methods like `flatMap()` preferred over manual implementations

**Style Rules:**
* `as const` assertions required for literal types
* Explicit length checks preferred over truthy checks on arrays
* Self-closing JSX elements required when no children
* Consistent member accessibility modifiers required on classes

**Security and Correctness:**
* `any` type explicitly prohibited
* Unused variables and imports not allowed
* Proper error handling patterns enforced

## Development Scripts

Configure these standard scripts in `package.json`:

```json
{
	"scripts": {
		"dev": "bun --hot src/index.ts",
		"build": "bun build src/index.ts --outdir dist",
		"test": "bun test",
		"test:watch": "bun test --hot",
		"lint": "bunx @biomejs/biome lint .",
		"lint:fix": "bunx @biomejs/biome lint --write .",
		"format": "bunx @biomejs/biome format --write .",
		"check": "bunx @biomejs/biome check .",
		"typecheck": "bunx tsc --noEmit"
	}
}
```

## Editor Integration

### VS Code Configuration
Recommended VS Code settings for the project:

```json
{
	"editor.defaultFormatter": "biomejs.biome",
	"editor.formatOnSave": true,
	"editor.codeActionsOnSave": {
		"quickfix.biome": "explicit",
		"source.organizeImports.biome": "explicit"
	},
	"typescript.preferences.includePackageJsonAutoImports": "off",
	"typescript.suggest.autoImports": false
}
```

### TypeScript Configuration
Essential `tsconfig.json` settings:

```json
{
	"compilerOptions": {
		"strict": true,
		"exactOptionalPropertyTypes": true,
		"noPropertyAccessFromIndexSignature": true,
		"noUncheckedIndexedAccess": true,
		"useUnknownInCatchVariables": true,
		"noImplicitOverride": true,
		"noImplicitThis": true,
		"moduleResolution": "bundler",
		"module": "ESNext",
		"target": "ESNext",
		"types": ["bun-types"]
	}
}
```

# Practical Examples

## Complete File Structure Example

A well-structured utility file following all conventions:

```typescript
// src/utilities/user-validation-utilities.ts

import { z } from "zod";
import type { Logger } from "~/logging/logger";
import { createLogger } from "~/logging/logger";

/**
 * Configuration options for user validation.
 */
export interface UserValidationConfig {
  /** Minimum required password length. */
  readonly minPasswordLength: number;
  /** Whether to require special characters in passwords. */
  readonly requireSpecialChars: boolean;
}

/**
 * Result of user data validation.
 */
export interface ValidationResult {
  /** Whether the validation passed. */
  readonly isValid: boolean;
  /** Array of validation error messages. */
  readonly errors: ReadonlyArray<string>;
}

/**
 * Schema for validating user registration data.
 */
export const UserRegistrationSchema = z.object({
  username: z.string()
    .min(3)
    .max(50)
    .describe("The user's unique username"),
  email: z.string()
    .email()
    .describe("The user's email address"),
  password: z.string()
    .min(8)
    .describe("The user's password")
});

export type UserRegistrationData = z.infer<typeof UserRegistrationSchema>;

const logger: Logger = createLogger("user-validation");

/**
 * Validates user registration data against business rules.
 *
 * This function performs comprehensive validation of user registration
 * data including format validation, uniqueness checks, and security
 * requirements for passwords.
 *
 * @param userData - The user data to validate.
 * @param config - Configuration options for validation rules.
 * @returns A validation result indicating success or failure with errors.
 *
 * @example
 * ```typescript
 * const result = await validateUserRegistrationAsync({
 *   username: "johndoe",
 *   email: "john@example.com",
 *   password: "SecurePass123!"
 * }, {
 *   minPasswordLength: 8,
 *   requireSpecialChars: true
 * });
 *
 * if (!result.isValid) {
 *   console.log("Validation errors:", result.errors);
 * }
 * ```
 *
 * @throws {ValidationError} When schema validation fails.
 */
export async function validateUserRegistrationAsync(
  userData: unknown,
  config: UserValidationConfig
): Promise<ValidationResult> {
  try {
    // Schema validation
    const validatedData = UserRegistrationSchema.parse(userData);
    const errors: Array<string> = [];

    // Password strength validation
    if (validatedData.password.length < config.minPasswordLength) {
      errors.push(`Password must be at least ${config.minPasswordLength} characters`);
    }

    if (config.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(validatedData.password)) {
      errors.push("Password must contain at least one special character");
    }

    // Username uniqueness check (example)
    const isUsernameUnique = await checkUsernameUniquenessAsync(validatedData.username);
    if (!isUsernameUnique) {
      errors.push("Username is already taken");
    }

    logger.info("User validation completed", {
      username: validatedData.username,
      isValid: errors.length === 0,
      errorCount: errors.length
    });

    return {
      isValid: errors.length === 0,
      errors
    };

  } catch (error) {
    logger.error("User validation failed", { error });
    throw new ValidationError("Schema validation failed", { cause: error });
  }
}

/**
 * Checks if a username is unique in the system.
 *
 * @param username - The username to check.
 * @returns A promise resolving to true if unique, false otherwise.
 */
async function checkUsernameUniquenessAsync(username: string): Promise<boolean> {
  // Implementation would check database
  return Promise.resolve(true);
}

/**
 * Custom error class for validation failures.
 */
export class ValidationError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ValidationError";
  }
}

export default validateUserRegistrationAsync;
```

## React Component Example

A complete React component following all conventions:

```typescript
// src/components/user-profile-card.tsx

import type { ReactNode } from "react";
import { useState, useCallback } from "react";
import type { User } from "~/types/user";
import { logger } from "~/logging/logger";

/**
 * Properties for the UserProfileCard component.
 */
export interface UserProfileCardProperties {
  /** The user data to display. */
  readonly user: User;
  /** Whether the current user can edit this profile. */
  readonly canEdit: boolean;
  /** Callback fired when the user data is updated. */
  readonly onUserUpdate?: (updatedUser: User) => Promise<void>;
  /** Additional CSS classes to apply to the card. */
  readonly className?: string;
}

/**
 * Displays user profile information in a card format.
 *
 * This component shows essential user details including avatar, name,
 * email, and other profile information. When editing is enabled, it
 * provides inline editing capabilities with validation and error handling.
 *
 * @param properties - The component properties.
 * @returns A user profile card element.
 *
 * @example
 * ```tsx
 * <UserProfileCard
 *   user={currentUser}
 *   canEdit={isCurrentUser}
 *   onUserUpdate={handleUserUpdate}
 *   className="profile-card"
 * />
 * ```
 */
export default function UserProfileCard(
  properties: UserProfileCardProperties
): ReactNode {
  const { user, canEdit, onUserUpdate, className } = properties;
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleEditToggle = useCallback((): void => {
    setIsEditing(previous => !previous);
    logger.debug("Profile edit mode toggled", {
      userId: user.id,
      isEditing: !isEditing
    });
  }, [user.id, isEditing]);

  const handleSaveAsync = useCallback(async (updatedUser: User): Promise<void> => {
    if (!onUserUpdate) return;

    setIsLoading(true);
    try {
      await onUserUpdate(updatedUser);
      setIsEditing(false);
      logger.info("User profile updated successfully", { userId: user.id });
    } catch (error) {
      logger.error("Failed to update user profile", { userId: user.id, error });
    } finally {
      setIsLoading(false);
    }
  }, [onUserUpdate, user.id]);

  return (
    <div className={`user-profile-card ${className ?? ""}`}>
      <div className="profile-header">
        <img
          src={user.avatarUrl}
          alt={`${user.name}'s avatar`}
          className="profile-avatar"
        />
        <div className="profile-info">
          <h3 className="profile-name">{user.name}</h3>
          <p className="profile-email">{user.email}</p>
        </div>
        {canEdit && (
          <button
            type="button"
            className="edit-button"
            onClick={handleEditToggle}
            disabled={isLoading}
            aria-label={isEditing ? "Cancel editing" : "Edit profile"}
          >
            {isEditing ? "Cancel" : "Edit"}
          </button>
        )}
      </div>

      {isEditing ? (
        <UserProfileEditForm
          user={user}
          onSave={handleSaveAsync}
          onCancel={handleEditToggle}
          isLoading={isLoading}
        />
      ) : (
        <UserProfileDisplay user={user} />
      )}
    </div>
  );
}
```

These examples demonstrate the comprehensive application of all style guide principles including TypeScript conventions, documentation standards, error handling patterns, and React component best practices.
