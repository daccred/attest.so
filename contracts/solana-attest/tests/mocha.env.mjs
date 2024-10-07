// mocha.env.mjs
import { Assertion, expect } from 'chai'

globalThis.Assertion = Assertion
globalThis.expect = expect

// these are for ts-node
process.env.NODE_ENV = 'test'
process.env.TS_NODE_PROJECT = 'test/tsconfig.json'
