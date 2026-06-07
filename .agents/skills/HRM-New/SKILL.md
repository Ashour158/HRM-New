```markdown
# HRM-New Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill provides guidance on contributing to the HRM-New TypeScript codebase. It covers coding conventions, file organization, import/export styles, and testing practices. While no specific automation workflows were detected, this document outlines best practices and suggested commands for efficient development.

## Coding Conventions

### File Naming
- Use **kebab-case** for all file names.
  - Example: `employee-list.ts`, `user-profile.test.ts`

### Import Style
- Mixed import styles are used. Both default and named imports may appear.
  - Example:
    ```typescript
    import { getUser } from './user-service'
    import config from './config'
    ```

### Export Style
- Prefer **named exports** for modules.
  - Example:
    ```typescript
    // user-service.ts
    export function getUser(id: string) { ... }
    export const USER_ROLE = 'admin'
    ```

### Commit Messages
- Freeform commit messages, often short (average 29 characters).
  - Example:  
    ```
    add login validation
    fix typo in employee list
    ```

## Workflows

### Running Tests
**Trigger:** When you need to verify code correctness.
**Command:** `/test`

1. Ensure you have installed dependencies:  
   `npm install`
2. Run all tests using Vitest:  
   `npx vitest`

### Adding a New Feature
**Trigger:** When implementing a new module or functionality.
**Command:** `/add-feature`

1. Create a new TypeScript file using kebab-case.
2. Use named exports for your functions or constants.
3. Add or update relevant import statements in other modules.
4. Write corresponding tests in a `.test.ts` file.
5. Commit changes with a clear, concise message.

### Writing Tests
**Trigger:** When adding or updating code.
**Command:** `/write-test`

1. Create a test file with the pattern `*.test.ts` (e.g., `user-service.test.ts`).
2. Use Vitest's testing API.
   - Example:
     ```typescript
     import { describe, it, expect } from 'vitest'
     import { getUser } from './user-service'

     describe('getUser', () => {
       it('returns user by id', () => {
         expect(getUser('123')).toEqual({ id: '123', name: 'Alice' })
       })
     })
     ```
3. Run tests to ensure correctness.

## Testing Patterns

- All tests are written in TypeScript using **Vitest**.
- Test files follow the `*.test.ts` naming convention.
- Example test structure:
  ```typescript
  import { describe, it, expect } from 'vitest'
  import { someFunction } from './some-module'

  describe('someFunction', () => {
    it('should work as expected', () => {
      expect(someFunction()).toBe(true)
    })
  })
  ```

## Commands

| Command      | Purpose                                  |
|--------------|------------------------------------------|
| /test        | Run all tests using Vitest               |
| /add-feature | Steps to add a new feature/module        |
| /write-test  | Steps to write and run a new test        |
```
