// chai.d.ts
import type * as chai from 'chai'

declare global {
  const expect: typeof chai.expect
  const Assertion: typeof chai.Assertion
}
