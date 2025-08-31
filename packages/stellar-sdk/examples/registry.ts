import { SorobanSchemaEncoder } from "../src"


/**
 * Pre-defined schema encoders for common use cases
 */
export class ExampleSchemaRegistry {
  private static schemas = new Map<string, SorobanSchemaEncoder>()

  /**
   * Register a schema encoder
   */
  static register(name: string, encoder: SorobanSchemaEncoder): void {
    this.schemas.set(name, encoder)
  }

  /**
   * Get a registered schema encoder
   */
  static get(name: string): SorobanSchemaEncoder | undefined {
    return this.schemas.get(name)
  }

  /**
   * List all registered schema names
   */
  static list(): string[] {
    return Array.from(this.schemas.keys())
  }
}