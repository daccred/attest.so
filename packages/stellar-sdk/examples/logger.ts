/**
 * Logging utilities for examples
 */

// ANSI escape codes for colors
export const an_c = '\x1b[36m' // Cyan
export const an_v = '\x1b[32m' // Green
export const an_ac = '\x1b[32m' // Green (for success)
export const an_e = '\x1b[31m' // Red
export const an = '\x1b[0m'    // Reset

/**
 * A simple logger for the examples
 * @param color - The ANSI color code
 * @param message - The message to log
 */
export function log(color: string, message: string) {
  console.log(`${color}${message}${an}`)
} 