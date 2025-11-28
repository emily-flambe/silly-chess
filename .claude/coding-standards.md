# Coding Standards

## TypeScript

### Strict Mode
- `strict: true` in tsconfig.json
- No implicit `any`
- Null checks required

### Types
- Define interfaces in `src/types.ts` for shared types
- Use explicit return types for public functions
- Prefer interfaces over type aliases for objects

```typescript
// Good
interface User {
  id: string;
  name: string;
}

// Avoid
type User = {
  id: string;
  name: string;
}
```

### Naming Conventions
- **Files**: PascalCase for classes (`Board.ts`), camelCase for utilities (`queries.ts`)
- **Classes**: PascalCase (`ChessEngine`, `StockfishWorker`)
- **Functions**: camelCase (`createGame`, `getBestMove`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_ELO`, `STORAGE_KEY`)
- **Interfaces**: PascalCase, no `I` prefix (`BoardState`, not `IBoardState`)

### Imports
- Use explicit imports, avoid `import *`
- Group imports: external, internal, types
- Use relative paths within the same module

```typescript
// External
import { Hono } from 'hono';

// Internal
import { ChessEngine } from '../lib/chess-engine';
import { StockfishWorker } from '../lib/stockfish';

// Types
import type { Env, GameResult } from './types';
```

## Code Style

### No Emojis
Do not use emojis in:
- Source code
- Comments
- Commit messages
- UI text
- Error messages

### Comments
- Comment "why", not "what"
- Use JSDoc for public APIs
- Keep comments concise

```typescript
// Good: Explains non-obvious decision
// Use sigmoid scaling to cap extreme evaluations at 90%
const percent = 50 + (clamped / maxEval) * 40;

// Bad: Restates the code
// Add 50 to the result
const percent = 50 + (clamped / maxEval) * 40;
```

### Error Handling
- Always handle errors explicitly
- Use try/catch for async operations
- Log errors with context
- Return meaningful error responses

```typescript
try {
  const result = await db.prepare(query).run();
  if (!result.success) {
    throw new Error('Database operation failed');
  }
} catch (error) {
  console.error('Error creating user:', error);
  return c.json({ error: 'Failed to create user' }, 500);
}
```

## Component Patterns

### Class-Based Components
```typescript
export class ComponentName {
  private container: HTMLElement;
  private callbacks: Array<() => void> = [];

  constructor(container: HTMLElement, options?: Options) {
    this.container = container;
    this.render();
    this.attachEventListeners();
  }

  public publicMethod(): void { }
  private privateMethod(): void { }

  public destroy(): void {
    // Clean up event listeners and DOM
  }
}
```

### Event Callbacks
```typescript
onEvent(callback: (data: T) => void): void {
  this.callbacks.push(callback);
}

private emit(data: T): void {
  this.callbacks.forEach(cb => cb(data));
}
```

## API Patterns

### Hono Routes
```typescript
app.get('/api/resource', async (c) => {
  try {
    const data = await fetchData(c.env.DB);
    return c.json(data);
  } catch (error) {
    console.error('Error:', error);
    return c.json({ error: 'Failed to fetch' }, 500);
  }
});
```

### D1 Queries
- Use parameterized queries (`.bind()`)
- Check `result.success` for writes
- Check `result.meta.changes` for updates/deletes

```typescript
const result = await db.prepare(
  'INSERT INTO users (id, name) VALUES (?, ?)'
).bind(userId, name).run();

if (!result.success) {
  throw new Error('Insert failed');
}
```

## Git Commits

### Format
```
type(scope): description

[optional body]

Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code change without feature/fix
- `chore`: Build, config, tooling
- `docs`: Documentation
- `test`: Tests

### Scope
- `chess-engine`, `stockfish`, `frontend`, `api`, `db`
