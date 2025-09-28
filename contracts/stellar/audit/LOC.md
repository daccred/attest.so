
## Total Lines of Code in `protocol/`: **5,161 lines**

### Breakdown by category:

**Source Code (`src/`): 1,927 lines**
- `instructions/`: 1,125 lines
  - `delegation.rs`: 372 lines
  - `attestation.rs`: 324 lines  
  - `crypto.rs`: 313 lines
  - `schema.rs`: 103 lines
  - `mod.rs`: 13 lines
- `lib.rs`: 268 lines
- `utils.rs`: 200 lines
- `state.rs`: 193 lines
- `interfaces/`: 55 lines
  - `resolver.rs`: 54 lines
  - `mod.rs`: 1 line
- `events.rs`: 52 lines
- `errors.rs`: 34 lines

**Tests (`tests/`): 3,234 lines**
- `protocol_attestation_test.rs`: 813 lines
- `protocol_cryptography_test.rs`: 810 lines
- `protocol_revocation_test.rs`: 479 lines
- `protocol_delegation_test.rs`: 351 lines
- `protocol_resolver_test.rs`: 250 lines
- `__protocol_bls_gaffine_test.rs`: 245 lines
- `testutils.rs`: 168 lines
- `protocol_initialization_and_schema.rs`: 118 lines

The protocol module contains a substantial amount of code, with the majority (62.7%) being test code, which indicates good test coverage for this critical component.


---
---


## Total Lines of Code in `authority/`: **2,346 lines**

### Breakdown by category:

**Source Code (`src/`): 1,406 lines**
- `lib.rs`: 271 lines
- `state.rs`: 185 lines
- `access_control.rs`: 186 lines
- `payment.rs`: 177 lines
- `macros.rs`: 152 lines
- `instructions/`: 336 lines
  - `resolver.rs`: 167 lines
  - `admin.rs`: 83 lines
  - `resolver_simple.rs`: 41 lines
  - `admin_simple.rs`: 43 lines
  - `mod.rs`: 2 lines
- `events.rs`: 70 lines
- `errors.rs`: 29 lines

**Tests (`tests/`): 940 lines**
- `authority_management_and_withdrawals.rs`: 655 lines
- `payment_and_admin_flow.rs`: 285 lines

## Comparison with Protocol:

- **Protocol**: 5,161 lines (1,927 source + 3,234 tests)
- **Authority**: 2,346 lines (1,406 source + 940 tests)

The authority module is significantly smaller than the protocol module, with about 45% fewer total lines of code. The authority module has a higher ratio of source code to tests (60% source vs 40% tests) compared to protocol (37% source vs 63% tests), suggesting the protocol module has more extensive test coverage.