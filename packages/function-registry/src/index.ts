import type { RegisteredFunction } from '@opencanvas/function-sdk';

export class InMemoryFunctionRegistry {
  private functions = new Map<string, RegisteredFunction>();

  register(fn: RegisteredFunction): void {
    this.functions.set(fn.name, fn);
  }

  get(name: string): RegisteredFunction | undefined {
    return this.functions.get(name);
  }

  list(): RegisteredFunction[] {
    return Array.from(this.functions.values());
  }
}
