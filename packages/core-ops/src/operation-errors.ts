export class OperationError extends Error {
  constructor(
    message: string,
    public readonly operationType?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'OperationError';
  }
}
