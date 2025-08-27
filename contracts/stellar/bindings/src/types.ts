/**
 * Represents the structure of a raw Soroban transaction simulation result,
 * including authorization entries, the return value, and transaction data.
 */
interface SorobanSimulationResult {
  /** An array of authorization entries, often empty. */
  auth: any[];

  /** The raw return value from the contract, as a base64-encoded XDR string. */
  retval: string;
}

/**
 * Defines the overall structure of the JSON payload containing the method name,
 * the transaction XDR, and the detailed simulation result.
 * 
 * @example
 * ```typescript
 * // A sample object that matches the TransactionSimulationPayload interface
 * const examplePayload: TransactionSimulationPayload = {
 *   method: "get_bls_key",
 *   tx: "AAAAAgAAAAAQZL/jg/tmvy7beaq869Zr11sY/vtFzILGk8hv1lKO0wACBiAAAGE9AAAAvwAAAAEAAAAAAAAAAAAAAABorlirAAAAAAAAAAEAAAAAAAAAGAAAAAAAAAABq3i/r6Mj6MLXIzRv+8k4bBMs3MLKTbCjQ/B5nv73xVUAAAALZ2V0X2Jsc19rZXkAAAAAAQAAABIAAAAAAAAAAN/Ne67KrwGQwgAvfUfT3r6qaZSw6nCqeFYcFCZ49SAnAAAAAAAAAAEAAAAAAAAAAwAAAAYAAAABq3i/r6Mj6MLXIzRv+8k4bBMs3MLKTbCjQ/B5nv73xVUAAAAQAAAAAQAAAAIAAAAPAAAAEUF0dGVzdGVyUHVibGljS2V5AAAAAAAAEgAAAAAAAAAA3817rsqvAZDCAC99R9PevqpplLDqcKp4VhwUJnj1ICcAAAABAAAABgAAAAGreL+voyPowtcjNG/7yThsEyzcwspNsKND8Hme/vfFVQAAABQAAAABAAAAB+p7j++qmUylkIMopmDeF0CYGdA9ZmlSDo3WpV+hO8g3AAAAAABDpicAAAAAAAAAAAAAAAAAAQLeAAAAAA==",
 *   simulationResult: {
 *     auth: [],
 *     retval: "AAAAEQAAAAEAAAACAAAADwAAAANrZXkAAAAADQAAAMAShCJAv8HkK9f0q9fRyMrlfo8mcJOyRMPpoSTp3GR2l+dM0NSaElgmutLphk4t2sAMEo37lJn/HO+CEJZq/PqZ9H0RyMihNG/I7K4nJtEw62bgYGB693e/gqAhyvUGGxEK7Z5lCilguNSwFY0rEmZoVweZnRyOzNwipr3+AFXFoFDjysHc2SKM0X6k1XjRP2IP4Ak0RhNEQr+utBK8xK9HLQ+ZQVGNMIcBb/CXmarmsV58bb2aGxhuLp3i0Ou+p8cAAAAPAAAADXJlZ2lzdGVyZWRfYXQAAAAAAAAFAAAAAGiuV34="
 *   },
 *   simulationTransactionData: "AAAAAAAAAAMAAAAGAAAAAat4v6+jI+jC1yM0b/vJOGwTLNzCyk2wo0PweZ7+98VVAAAAEAAAAAEAAAACAAAADwAAABFBdHRlc3RlclB1YmxpY0tleQAAAAAAABIAAAAAAAAAAN/Ne67KrwGQwgAvfUfT3r6qaZSw6nCqeFYcFCZ49SAnAAAAAQAAAAYAAAABq3i/r6Mj6MLXIzRv+8k4bBMs3MLKTbCjQ/B5nv73xVUAAAAUAAAAAQAAAAfqe4/vqplMpZCDKKZg3hdAmBnQPWZpUg6N1qVfoTvINwAAAAAAQ6YnAAAAAAAAAAAAAAAAAAEC3g=="
 * };
 * ```
 */
export interface TransactionSimulationPayload {
  /** The name of the contract method that was called (e.g., "get_bls_key"). */
  method: string;

  /** The full transaction XDR, encoded as a base64 string. */
  tx: string;

  /** The detailed result from the simulation. */
  simulationResult: SorobanSimulationResult;

  /**
   * Soroban-specific data related to the transaction, including resource usage
   * and contract footprints, encoded as a base64 string.
   */
  simulationTransactionData: string;
}

