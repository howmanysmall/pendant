---
description: Use Bun instead of Node.js, npm, pnpm, or vite. Comprehensive TypeScript and documentation standards.
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

You are an expert in Bun, a modern JavaScript runtime like Node.js, but with a focus on performance, simplicity, modern features, and well designed code.

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";

// import .css files directly and it works
import './index.css';

import { createRoot } from "react-dom/client";

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.md`.

## Bun Specifics

- Prefer Bun-specific APIs and features when possible.
- If a Node.js API is not available in Bun, suggest a Bun alternative or workaround.
- Always provide clear, concise, and idiomatic TypeScript code.
- Explain any Bun-specific commands or configuration if used.
- Use `bun`, not `npm`, `pnpm`, or `yarn`.
- Node libraries may not be available, but generally are.
- Use `bun add` to install dependencies.
- Use `bun run` to run scripts.
- Prefer Bun's built-in test runner: write tests in `*.test.ts` and run them with `bun test`.
- Demonstrate file watching with `bun run --watch` for rapid development.
- Show examples using Bun's native APIs (e.g. `Bun.serve`, `Bun.file`, `Bun.spawn`) before falling back to Node-compat shims.
- If using environment variables, illustrate loading them via `import.meta.env`.
- For bundling, highlight `bun build --target <platform>` and its options.
- When relevant, show how to leverage Bun's SQLite integration (`import { DB } from "bun:sqlite"`).
- Use `Bun.file` for file operations instead of `fs` when possible.
- Use `Bun.serve` for HTTP servers instead of `http` or `https`.
- Use `Bun.spawn` for child processes instead of `child_process`.
- Use `Bun.env` for environment variables instead of `process.env`.
- Use `Bun.fetch` for HTTP requests instead of `node-fetch` or `axios`.
- Use `Bun.write` for file writing instead of `fs.writeFile`.
- Install Bun's TypeScript definitions by running `bun add -d @types/bun` and include `"types": ["bun-types"]` in your `tsconfig.json` to avoid editor errors.
- Leverage Bun's runtime support for `compilerOptions.paths`: Bun respects your path mappings at runtime, eliminating the need for extra bundler configuration.
- Centralize project configuration in `bunfig.toml`, defining scripts, registry settings (`[install.registry]`), and test options in one place.
- Use `import.meta.main` to detect if the current module is the entry point, replacing the `require.main === module` pattern.
- Build standalone executables with `bun build --compile --target=<platform>` (e.g. `bun build --compile --target=bun-linux-x64 ./src/index.ts --outfile myapp`).
- Configure Bun's test runner via the `[test]` section in `bunfig.toml` to set timeouts, roots, and coverage thresholds.
- Use `bun --hot` during development for in-process hot-reload without a full restart; pair it with test runs (`bun test --hot`) for instant feedback.
- Serve static assets with a one-liner: `Bun.serve({ port: 3000, dir: "public" })`, eliminating the need for an extra Express/Vite dev server.
- For quick, editor-style type-checks, run `bunx tsc --noEmit` (or `bunx tsc -b --incremental` in monorepos) to leverage Bun's download-free package runner.

# Documentation Standards

## Guiding Philosophy

**Document everything that is public.** Every exported class, function, type, interface, constant, and module must have clear, comprehensive JSDoc documentation. Documentation is not an afterthought; it is an integral part of the code itself.

## JSDoc Requirements

1. **Use JSDoc Format:** All documentation comments must be in JSDoc format (`/** ... */`).
2. **Start with a Summary:** The first line of any JSDoc block must be a concise, single-sentence summary of the element's purpose.
3. **Provide Detail:** For complex logic, components, or functions, follow the summary with a more detailed paragraph explaining its behavior, rationale, and any important considerations.
4. **Use Markdown:** Utilize Markdown within JSDoc comments for formatting, such as backticks for code (`code`), bolding for emphasis, and lists for clarity.
5. **Write for Clarity:** Write documentation in clear, simple language. Avoid jargon where possible, or explain it if necessary.

## JSDoc Tag Usage

Use JSDoc tags to provide structured information. The following tags are commonly used and recommended:

- `@param`: Describe a function, method, or hook parameter. Include the parameter's type and a clear description of its purpose.
- `@returns`: Describe the return value of a function, method, or hook.
- `@example`: Provide one or more code snippets demonstrating how to use the element. Wrap the code in a Markdown code block with the language specified (e.g., ` ```typescript `).
- `@remarks`: Add supplementary notes, implementation details, or warnings that don't fit in the main description.
- `@see`: Link to related parts of the codebase or external documentation.
- `@template`: For generic functions, classes, or types, describe the generic type parameters.
- `@throws`: Document any errors that a function or method might explicitly throw.

## General TypeScript

- Use ESM-style imports/exports and avoid CommonJS.
- Do not use `any` type; prefer specific types or `unknown` (or `never`) when necessary.
- **Use JSDoc comments on exported functions/types** - this is mandatory for all public APIs.
- Define consistent naming conventions: `PascalCase` for types/interfaces, `camelCase` for functions, `SCREAMING_SNAKE_CASE` for constants.
- Use `const` for constants and `let` for variables that may change.
- Use `async/await` for asynchronous code.
- Use `Promise` for asynchronous functions.
- Use `type` for type aliases and `interface` for interfaces.
- Use `enum` for enumerations.
- Use `import type` for type-only imports.
- Use `export type` for type exports.
- Use `export default` for default exports when appropriate.
- Use `import.meta` for module metadata.
- Use `import.meta.env` for environment variables.
- Use `import.meta.url` for the current module URL.
- Use `import.meta.resolve` for resolving module paths.
- Enable strict compiler options in your tsconfig (strict, strictNullChecks, noImplicitAny, noUnusedLocals, noUnusedParameters, noImplicitReturns, noFallthroughCasesInSwitch).
- Explicitly annotate return types on all exported functions (even if TS can infer them) to keep your public API clear.
- Favor immutability: use `readonly` on object properties, `Readonly<T>` for arrays, and `as const` for literal tuples.
- Do not use `X[]` for arrays, use `Array<X>` instead for consistency and to avoid confusion with tuple types.
- Use optional chaining (`?.`) and nullish coalescing (`??`) instead of manual existence checks.
- Model complex states with discriminated unions and exhaustive `switch`cases, using a `never` default branch to catch unhandled variants.
- Leverage utility types (`Partial`, `Required`, `Pick`, `Omit`, `Record`, `ReturnType`, `Parameters`, etc.) to DRY up and evolve types safely.
- Prefer `unknown` over `any` for untyped inputs and write type-guard functions (e.g. `isFoo(x): x is Foo`) to narrow them.
- Define and use path aliases in tsconfig (`baseUrl` + `paths`) for clearer, non-fragile imports.
- Limit use of `as` casts and `// @ts-ignore`/`// @ts-expect-error`; strive to codify correct types instead of silencing errors.
- Integrate ESLint (with `@typescript-eslint`) and Prettier into your editor and CI to enforce consistent style and catch subtle bugs.
- Document complex types and public APIs with TSDoc (`/** & */`) so editors can surf your docs inline.
- When a function accepts multiple or optional parameters, prefer a single `options: { & }` object over long parameter lists.
- Use default parameter values (`function fn(x = 42)`) to avoid accidental `undefined` propagation.
- Avoid internal `namespace` blocksfavor ES modules and per-file exports instead.
- Group imports into logical sections (external modules, path-aliases, relative imports), separated by blank lines for readability.
- Use top-level `await` (in ESM files) sparingly for initialization scripts or REPL-style code, knowing Bun and modern bundlers support it.
- Enable `noUncheckedIndexedAccess` in `tsconfig.json` to make all indexed array/tuple accesses potentially `undefined`, forcing explicit checks.
- Turn on `exactOptionalPropertyTypes` to distinguish between truly absent properties and those explicitly set to `undefined`.
- Use `strictFunctionTypes` for contravariant checking of function parameters, preventing unsafe assignments of functions with incompatible signatures.
- Employ branded (nominal) types, e.g. `type UserId = string & { __brand: "UserId" };`, to prevent mixing values like `UserId` and `ProductId` even though both are `string`.
- Enable incremental builds and composite project references in `tsconfig.json` (`"incremental": true`, `"composite": true`) to speed up rebuilds and support monorepos.
- Enable `strictBindCallApply` in your `tsconfig.json` to enforce correct signatures when using `.bind`, `.call`, and `.apply`.
- Turn on `noImplicitOverride` so that any class member overriding a base method must be marked with the `override` keyword.
- Enable `noImplicitThis` to catch invalid or unexpected `this` usages in functions and methods.
- Use `noPropertyAccessFromIndexSignature` to prevent accidental dynamic property access that bypasses your indexsignature types.
- Enable `noUnnecessaryTypeAssertion` and `noUnusedTypeParameters` to catch redundant `as` casts and unused generic type parameters.
- Do not EVER use null.
- Leverage TS 4.9's `satisfies` operator when declaring object literals to validate against interfaces without widening literal types:
  ```ts
  const config = {
    host: "localhost",
    port: 8080,
  } satisfies ServerConfig;
  ```
- Write userdefined typeguard functions with `asserts` signatures for runtime checks and compiletime narrowing:
  ```ts
  function assertFoo(x: unknown): asserts x is Foo {
    if (!isFoo(x)) throw new Error("Not a Foo");
  }
  ```
- Use template literal types and conditional/mapped types to express complex string patterns and transforms in your public APIs.
- Prefer `ReadonlyMap<K, V>` and `ReadonlySet<T>` (or `Readonly<Record<K, V>>`) for collections you don't intend to mutate.
- Mark deprecated APIs with the `@deprecated` TSDoc tag to signal upcoming removals or replacements in editor tooltips and docs.
- Integrate a schemavalidation library (e.g. Zod, Yup) for parsing and validating untrusted inputs while preserving inferred TS types.
- Define and enforce import ordering and grouping via ESLint (`sort-imports` or similar) to keep external, alias, and relative imports well organized.
- Use project references (`"composite": true`) in `tsconfig.json` to split large codebases or monorepos into faster incremental build units.
- Pin your Bun version in `package.json`'s `engines.bun` field and check it at runtime via `import.meta.bunVersion` to ensure consistent environments.
- Leverage Bun's `import.meta.glob`/`globEager` (when available) for filesystembased code loading or route registration without additional dependencies.
- Do not import files with `require`, `import * as x from "./x.ts"`, or `import * as x from "./x.js"`; always use `import * as x from "./x"`.
- File names are `kebab-case`, always. Do not stray from this.
- Use biome for linting and formatting.
- Always prefer `export default` for primary exports.
- Do not ever use `console.*`, use the `logger` equivalent from the logger library.
- If a block can be on a single line, it should be a single line. What I mean by this is you do not need to include braces.
- You must always declare class modifiers. Do not ever miss these.
- Async functions always have async in the name - like what Roblox does. `async function getCoolGuy()` should be `async function getCoolGuyAsync()`. On the contrary, if the function isn't async, it does not end with sync.

## Documentation by Code Construct

### Functions & Methods

- All exported functions and public class methods must be documented.
- The documentation must include a description of what the function does.
- It must include a `@param` tag for each parameter.
- It must include a `@returns` tag describing the return value.

**Example:**

```typescript
/**
 * Calculates the sum of two numbers.
 *
 * @param a - The first number.
 * @param b - The second number.
 * @returns The sum of `a` and `b`.
 */
export function add(a: number, b: number): number {
    return a + b;
}
```

### Classes

- Every exported class must have a JSDoc block describing its purpose and responsibility.
- Public properties and methods must be documented individually according to their respective rules.
- The constructor should be documented if it performs complex initialization logic.

**Example:**

```typescript
/**
 * Manages user authentication and session lifecycle.
 *
 * This class handles login/logout operations, session validation,
 * and user credential management with secure session state.
 */
export class AuthenticationManager {
    /**
     * Creates a new authentication manager instance.
     *
     * @param config - Configuration options for authentication behavior.
     */
    public constructor(private readonly config: AuthConfig) {
        // implementation
    }

    /**
     * Authenticates a user with email and password.
     *
     * @param email - The user's email address.
     * @param password - The user's password.
     * @returns A promise resolving to the authentication result.
     * @throws {AuthenticationError} When credentials are invalid.
     */
    public async loginAsync(email: string, password: string): Promise<AuthResult> {
        // implementation
    }
}
```

### Interfaces & Types

- All exported interfaces and type aliases must be documented with a description of what they represent.
- Each property within an interface or type must have a JSDoc comment directly above it describing its purpose.

**Example:**

```typescript
/** Represents a user in the system. */
export interface User {
    /** The unique identifier for the user. */
    readonly id: string;
    /** The user's full name. */
    readonly name: string;
    /** The user's primary email address. */
    readonly email: string;
}

/**
 * Configuration options for user validation.
 */
export type ValidationConfig = {
    /** Minimum required password length. */
    readonly minPasswordLength: number;
    /** Whether to require special characters in passwords. */
    readonly requireSpecialChars: boolean;
};
```

### Enums & Constants

- All exported enums and constants must have a JSDoc block explaining their purpose.
- For enums, individual members should be commented if their meaning is not immediately obvious from the name.

**Example:**

```typescript
/** Defines the set of supported authentication methods. */
export enum AuthenticationMethod {
    /** Standard email and password authentication. */
    EMAIL_PASSWORD = "email_password",
    /** Single sign-on via OAuth providers. */
    OAUTH = "oauth",
    /** Multi-factor authentication. */
    MFA = "mfa",
}

/** Maximum number of login attempts before account lockout. */
export const MAX_LOGIN_ATTEMPTS = 5;
```

### React Hooks

- Custom React hooks must have a JSDoc block explaining their purpose and usage.
- Document parameters with `@param` and the return value (often an object or array) with `@returns`.
- Clearly describe the properties of the returned object or the elements of the returned array.

**Example:**

```typescript
/**
 * A hook to manage a boolean toggle state.
 *
 * @param initialState - The initial state of the toggle.
 * @returns An object containing the current state and functions to toggle, enable, or disable it.
 */
export function useToggle(initialState: boolean): {
    /** The current boolean state. */
    readonly state: boolean;
    /** A function to toggle the state. */
    readonly toggle: () => void;
} {
    // ... implementation
}
```

### React Components

- All exported components must be documented.
- The documentation should describe the component's role and appearance.
- Use JSDoc to describe the `properties` object and each individual property within it.

**Example:**

```typescript
import type { ReactNode } from "react";

/**
 * Properties for the Button component.
 */
export interface ButtonProperties {
    /** The content to display inside the button. */
    readonly children: ReactNode;
    /** An optional click handler. */
    readonly onClick?: () => void;
    /** Whether the button is disabled. */
    readonly disabled?: boolean;
}

/**
 * A standard button component with consistent styling.
 *
 * @param properties - The properties for the component.
 * @returns A button element.
 *
 * @example
 * ```tsx
 * <Button onClick={handleClick} disabled={isLoading}>
 *   Save Changes
 * </Button>
 * ```
 */
export default function Button(properties: ButtonProperties): ReactNode {
    // ... implementation
}
```

### Zod Schemas

- Zod schemas are a form of documentation themselves, but they must still be accompanied by JSDoc.
- The schema object itself should have a JSDoc comment explaining the data structure it validates.
- Use `.describe()` on individual fields to explain the validation rule and the property's purpose. This integrates documentation directly into the schema.

**Example:**

```typescript
import { z } from "zod";

/**
 * Defines the schema for a user profile.
 */
export const UserProfileSchema = z.object({
    username: z.string().min(3).describe("The user's public display name."),
    email: z.string().email().describe("The user's primary email address."),
    age: z.number().min(13).describe("The user's age in years."),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;
```

### CLI Commands

- For CLI commands (e.g., using `clipanion`), the `usage` property must be thoroughly documented.
- The `description` should be a concise summary of what the command does.
- The `details` section should provide a comprehensive explanation of the command's functionality, flags, and behavior.
- The `examples` array should include several practical examples of how to use the command with different options.
- Each command-line option (`Option.String`, `Option.Boolean`, etc.) must have a clear and helpful `description`.

**Example:**

```typescript
import { Command, Option } from "clipanion";

/**
 * Command to analyze code quality and generate reports.
 */
export class AnalyzeCommand extends Command {
    static readonly paths = [['analyze']];

    static readonly usage = Command.Usage({
        description: 'Analyze code quality and generate detailed reports',
        details: `
            This command performs comprehensive code analysis including:
            - TypeScript type checking
            - Linting with Biome
            - Code complexity analysis
            - Test coverage reporting

            Results are saved to the specified output directory and can be
            formatted in multiple output formats for different use cases.
        `,
        examples: [
            ['Analyze with default settings', 'pendant analyze'],
            ['Analyze with custom output directory', 'pendant analyze --output ./reports'],
            ['Generate JSON report', 'pendant analyze --format json'],
        ],
    });

    /** The output directory for analysis reports. */
    private readonly outputDir = Option.String('--output,-o', './analysis', {
        description: 'Directory where analysis reports will be saved',
    });

    /** The output format for the analysis report. */
    private readonly format = Option.String('--format,-f', 'html', {
        description: 'Output format: html, json, or markdown',
    });
}
```

## Advanced TypeScript

- Enable `"exactOptionalPropertyTypes": true` to distinguish between a missing property and one explicitly set to `undefined`, preventing subtle runtime bugs.
- Turn on `"noPropertyAccessFromIndexSignature": true` so accidental typos like `user.nmae` fail at compile time instead of silently hitting an index-signature.
- Adopt the **`satisfies`** operator to ensure a value conforms to an interface while keeping its literal types (e.g., `const colors = {...} satisfies Record<ColorName, string>`).
- Prefer `"useUnknownInCatchVariables": true` (or `catch (e: unknown)`) so you must narrow caught errors before you can inspect them.
- Write assertion functions with `asserts` return typese.g.,
  `function assertFoo(x: unknown): asserts x is Foo { /* runtime check */ }`to combine validation and type-narrowing.
- Add `function assertNever(x: never): never { throw new Error("Unhandled case"); }` in default branches to guarantee exhaustive discriminated-union handling.
- Use template-literal types to model string invariants, e.g., `type Hex = \`0x${string}\`` or `type Brand<T, B> = T & { __brand: B }`.
- Set `"moduleResolution": "bundler"` (with `"module": "es2020"`) so TypeScript resolves imports exactly as Bun or Vite would, avoiding extension-related false errors.
- In multi-package repos, enable `"incremental": true` and `"composite": true`, then invoke `tsc -b` for fast, dependency-aware builds; add `bunx tsc -w -b` to your dev script for live type-checking.

## Web Design

Keep in mind that I am unable to do this properly. You will be all on your own.

- You will design the UI so that it works well on any device, even if this CLI is desktop only currently.
- You will design a clean looking interface.
- You will maintain a consistent style.
- Design for accessibility and keyboard navigation; follow WCAG guidelines.
- Use mobile-first, fluid layouts and responsive design patterns.
- Build and document a design system (colors, spacing, typography, components).
- Provide clear, immediate feedback for all user actions.
- Prioritize usability, legibility, and simplicity in all UI elements.
- Optimize for performance: compress assets, lazy-load where possible.
- Support theming and customization, respecting system preferences.
- Document design decisions and link to relevant resources or prototypes.

## React

- Build small, focused, reusable components: one component = one responsibility; avoid "god components"
- Use functional components and hooks (useState, useEffect, useRef, useContext, useReducer, custom hooks) instead of class components
- Treat props as read-only - never modify props directly
- Lift state up to the nearest common ancestor to share data; avoid unnecessary prop-drilling; consider using Context for cross-tree state
- Favor TypeScript to enforce component interfaces and catch bugs early
- Optimize re-renders using React.memo, PureComponent, useMemo, and useCallback where appropriate
- Clean up effects: always return a cleanup function in useEffect to avoid memory leaks or duplicate actions
- Avoid inline styles; prefer CSS modules, styled-components or class-based styling for maintainability
- Use fragments (<>...</>) instead of unnecessary wrapper <div>s
- Provide unique, stable keys in lists; never use array indexes unless unavoidable
- Avoid deriving state unnecessarily; compute from props or other state, and wrap expensive calculations in useMemo
- Custom hooks for shared logic: extract reusable side-effects or business logic into `use&` hooks
- Use Context API wisely: only for truly shared state (e.g., theme, auth); avoid overusing it
- Separate presentation and container components: presentational handle UI, container manage state and logic
- Use error boundaries to catch and handle rendering errors gracefully (especially in production)
- Adopt a consistent code style enforced via ESLint & Prettier; include naming conventions (PascalCase for components, camelCase for props/state)
- Structure project by feature or domain, not type; group components, hooks, styles and tests within feature folders
- Use code-splitting & lazy loading (React.lazy, Suspense) for performance on large components
- Use modern React frameworks (Next.js, Remix, etc.) for built-in routing, SSR/SSG, and performance optimizations
- Test components with Jest + React Testing Library, focusing on behavior and interactions, not implementation details
- Avoid state mutation-always use setter functions (setState, state updaters); rely on immutability patterns for performance and correctness
- Use destructuring for props and state to keep code concise and readable
- Secure your app: sanitize any dangerouslySetInnerHTML usage, update dependencies to avoid known vulnerabilities
- Optimize development experience: use snippets boilerplate carefully, build solid foundational understanding of React lifecycle and hooks
- Regular code reviews and CI checks enforce standards, catch bugs early, ensure maintainability
- Continue from the rules found previously.
- Do not use `props`, write out `properties`. I am serious when I say do not use word shorthands.
- Keeping with the previous rule, do not use `ref`, you will rewrite `reference`. I am serious when I say do not use word shorthands.
- Do not use unnamed anonymous functions inside of `useEffect` hooks. It makes debugging difficult and annoying.
- Follow the structure you can find inside of my react.code-snippets file.
- Components should remain about 100 lines maximum unless you cannot do it otherwise.
- Prioritize GOOD organization skills.
- You MUST ALWAYS use the `key` property for components.

# important-instruction-reminders

Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.

# Extra Instructions

## Useful Command-Line Tools

### GitHub

- Use the `gh` command-line to interact with GitHub.

### Markdown

- Use the `glow` command-line to present markdown content.

### JSON

- Use the `jq` command to read and extract information from JSON files.

### RipGrep

- The `rg` (ripgrep) command is available for fast searches in text files.

### Clipboard

- Pipe content into `pbcopy` to copy it into the clipboard. Example: `echo "hello" | pbcopy`.
- Pipe from `pbpaste` to get the contents of the clipboard. Example: `pbpaste > fromclipboard.txt`.

### JavaScript / TypeScript

- Unless instructed otherwise, always use `bun` to run .js or .ts scripts.
- Use `bun x` for running commands directly from npm packages. You should use `bun x --bun` for stuff that benefits from it such as Biome.

## Documentation Sources

- If working with a new library or tool, consider looking for its documentation from its website, GitHub project, or the relevant llms.txt.
  - It is always better to have accurate, up-to-date documentation at your disposal, rather than relying on your pre-trained knowledge.
- You can search the following directories for llms.txt collections for many projects:
  - https://llmstxt.site/
  - https://directory.llmstxt.cloud/
- If you find a relevant llms.txt file, follow the links until you have access to the complete documentation.
