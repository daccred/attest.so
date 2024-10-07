// expect-util.ts

export class Expectation<T> {
  constructor(private actual: T) {}

  // Basic equality
  to = {
    equal: (expected: T) => {
      if (this.actual !== expected) {
        throw new Error(
          `Expected ${JSON.stringify(this.actual)} to equal ${JSON.stringify(expected)}`
        )
      }
      return true
    },

    // Deep equality for objects
    deepEqual: (expected: T) => {
      if (JSON.stringify(this.actual) !== JSON.stringify(expected)) {
        throw new Error(
          `Expected ${JSON.stringify(this.actual)} to deeply equal ${JSON.stringify(expected)}`
        )
      }
      return true
    },

    // Boolean checks
    be: {
      true: () => {
        if (this.actual !== true) {
          throw new Error(`Expected ${this.actual} to be true`)
        }
        return true
      },
      false: () => {
        if (this.actual !== false) {
          throw new Error(`Expected ${this.actual} to be false`)
        }
        return true
      },
      null: () => {
        if (this.actual !== null) {
          throw new Error(`Expected ${this.actual} to be null`)
        }
        return true
      },
      undefined: () => {
        if (this.actual !== undefined) {
          throw new Error(`Expected ${this.actual} to be undefined`)
        }
        return true
      },
    },

    // String matching
    match: (regex: RegExp) => {
      if (typeof this.actual !== 'string') {
        throw new Error('Can only match against strings')
      }
      if (!regex.test(this.actual)) {
        throw new Error(`Expected "${this.actual}" to match ${regex}`)
      }
      return true
    },

    // Array inclusion
    include: (expected: any) => {
      if (!Array.isArray(this.actual)) {
        throw new Error('Can only check inclusion on arrays')
      }
      if (!this.actual.includes(expected)) {
        throw new Error(
          `Expected ${JSON.stringify(this.actual)} to include ${JSON.stringify(expected)}`
        )
      }
      return true
    },

    // Length checking
    haveLength: (expected: number) => {
      const actual = (this.actual as any[]).length
      if (actual !== expected) {
        throw new Error(`Expected length of ${actual} to equal ${expected}`)
      }
      return true
    },

    // Numeric comparisons
    greaterThan: (expected: number) => {
      if (typeof this.actual !== 'number') {
        throw new Error('Can only compare numbers')
      }
      if (this.actual <= expected) {
        throw new Error(`Expected ${this.actual} to be greater than ${expected}`)
      }
      return true
    },

    lessThan: (expected: number) => {
      if (typeof this.actual !== 'number') {
        throw new Error('Can only compare numbers')
      }
      if (this.actual >= expected) {
        throw new Error(`Expected ${this.actual} to be less than ${expected}`)
      }
      return true
    },
  }
}

export const customExpect = <T>(actual: T) => new Expectation(actual)
