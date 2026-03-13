export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}
