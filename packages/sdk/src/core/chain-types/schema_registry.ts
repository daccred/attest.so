/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/schema_registry.json`.
 */
export type SchemaRegistry = {
  "address": "7LUEYmyYUDct4jA9sHkpCpmDrsC8ZAKsk8g6v8BJbFBe",
  "metadata": {
    "name": "schemaRegistry",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Schema registry program for the attestation service"
  },
  "instructions": [
    {
      "name": "register",
      "docs": [
        "Registers a new schema in the registry.",
        "",
        "# Arguments",
        "",
        "* `ctx` - The context containing the accounts required for schema registration.",
        "* `schema_name` - The name of the schema, used in PDA derivation.",
        "* `schema` - The actual schema data (e.g., JSON schema as a string).",
        "* `resolver` - An optional resolver address for external verification.",
        "* `revocable` - A boolean indicating whether the schema is revocable.",
        "",
        "# Returns",
        "",
        "* `Result<()>` - Returns an empty Ok result on success.",
        "",
        "# Errors",
        "",
        "* May return errors from the `register_schema` function.",
        "",
        "# Implementation Details",
        "",
        "- Calls the `register_schema` function from the `sdk` module to perform the registration.",
        "- Logs the UID of the registered schema.",
        "",
        "# Why We Are Doing This",
        "",
        "Registering schemas allows users to define and store custom data structures",
        "that can be referenced in attestations. This function serves as the entry point",
        "for schema registration, delegating the actual logic to the `sdk` module."
      ],
      "discriminator": [
        211,
        124,
        67,
        15,
        211,
        194,
        178,
        240
      ],
      "accounts": [
        {
          "name": "deployer",
          "docs": [
            "Deployer who creates the schema."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "schemaData",
          "docs": [
            "Schema data stored at the derived PDA."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  99,
                  104,
                  101,
                  109,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "deployer"
              },
              {
                "kind": "arg",
                "path": "schemaName"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "schemaName",
          "type": "string"
        },
        {
          "name": "schema",
          "type": "string"
        },
        {
          "name": "resolver",
          "type": {
            "option": "pubkey"
          }
        },
        {
          "name": "revocable",
          "type": "bool"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "schemaData",
      "discriminator": [
        193,
        151,
        116,
        128,
        165,
        185,
        163,
        24
      ]
    }
  ],
  "events": [
    {
      "name": "registeredSchema",
      "discriminator": [
        252,
        192,
        249,
        10,
        9,
        157,
        30,
        1
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "schemaAlreadyExists",
      "msg": "Schema already exists."
    }
  ],
  "types": [
    {
      "name": "registeredSchema",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "uid",
            "docs": [
              "The generated UID for the schema (PDA)."
            ],
            "type": "pubkey"
          },
          {
            "name": "schemaData",
            "docs": [
              "Full schema data including schema, resolver, revocable, and deployer."
            ],
            "type": {
              "defined": {
                "name": "schemaData"
              }
            }
          }
        ]
      }
    },
    {
      "name": "schemaData",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "uid",
            "docs": [
              "Generate PDA as reference key."
            ],
            "type": "pubkey"
          },
          {
            "name": "schema",
            "docs": [
              "The actual schema data (e.g., JSON, XML, etc.)."
            ],
            "type": "string"
          },
          {
            "name": "resolver",
            "docs": [
              "Resolver address (another contract) for schema verification."
            ],
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "revocable",
            "docs": [
              "Indicates whether the schema is revocable."
            ],
            "type": "bool"
          },
          {
            "name": "deployer",
            "docs": [
              "The deployer/authority who created the schema."
            ],
            "type": "pubkey"
          }
        ]
      }
    }
  ]
};
