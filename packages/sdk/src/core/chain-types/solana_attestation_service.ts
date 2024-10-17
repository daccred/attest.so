/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/solana_attestation_service.json`.
 */
export type SolanaAttestationService = {
  "address": "4N3q84f1FbZLzH5CPXVb7aSgV8WcSKghyuz2PdbZS3Y2",
  "metadata": {
    "name": "solanaAttestationService",
    "version": "0.1.1",
    "spec": "0.1.0",
    "description": "The core attestation service implementation for Solana"
  },
  "instructions": [
    {
      "name": "createAttestation",
      "discriminator": [
        49,
        24,
        67,
        80,
        12,
        249,
        96,
        239
      ],
      "accounts": [
        {
          "name": "attester",
          "docs": [
            "The attester who is creating the attestation."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "recipient"
        },
        {
          "name": "schemaData",
          "docs": [
            "The schema data account; must match the schema UID."
          ]
        },
        {
          "name": "deployer",
          "relations": [
            "schemaData"
          ]
        },
        {
          "name": "attestation",
          "docs": [
            "The attestation account to be created."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  116,
                  116,
                  101,
                  115,
                  116,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "schemaData"
              },
              {
                "kind": "account",
                "path": "recipient"
              },
              {
                "kind": "account",
                "path": "attester"
              }
            ]
          }
        },
        {
          "name": "schemaRegistryProgram",
          "docs": [
            "The Schema Registry program account for CPI."
          ],
          "address": "7LUEYmyYUDct4jA9sHkpCpmDrsC8ZAKsk8g6v8BJbFBe"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "data",
          "type": "string"
        },
        {
          "name": "refUid",
          "type": {
            "option": "pubkey"
          }
        },
        {
          "name": "expirationTime",
          "type": {
            "option": "i64"
          }
        },
        {
          "name": "revocable",
          "type": "bool"
        }
      ]
    },
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [],
      "args": []
    },
    {
      "name": "revokeAttestation",
      "discriminator": [
        12,
        156,
        103,
        161,
        194,
        246,
        211,
        179
      ],
      "accounts": [
        {
          "name": "attester",
          "docs": [
            "The attester who is revoking the attestation."
          ],
          "writable": true,
          "signer": true,
          "relations": [
            "attestation"
          ]
        },
        {
          "name": "attestation",
          "docs": [
            "The attestation account to be revoked."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  116,
                  116,
                  101,
                  115,
                  116,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "arg",
                "path": "schemaUid"
              },
              {
                "kind": "arg",
                "path": "recipient"
              },
              {
                "kind": "account",
                "path": "attester"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "schemaUid",
          "type": "pubkey"
        },
        {
          "name": "recipient",
          "type": "pubkey"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "attestation",
      "discriminator": [
        152,
        125,
        183,
        86,
        36,
        146,
        121,
        73
      ]
    },
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
      "name": "attested",
      "discriminator": [
        184,
        102,
        113,
        199,
        220,
        197,
        96,
        50
      ]
    },
    {
      "name": "revoked",
      "discriminator": [
        113,
        216,
        148,
        99,
        124,
        184,
        0,
        65
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidSchema",
      "msg": "Invalid Schema"
    },
    {
      "code": 6001,
      "name": "notFound",
      "msg": "Attestation not found."
    },
    {
      "code": 6002,
      "name": "alreadyRevoked",
      "msg": "Attestation already revoked."
    },
    {
      "code": 6003,
      "name": "irrevocable",
      "msg": "Schema is not revocable."
    },
    {
      "code": 6004,
      "name": "invalidExpirationTime",
      "msg": "Invalid expiration time."
    },
    {
      "code": 6005,
      "name": "dataTooLarge",
      "msg": "Data too large."
    }
  ],
  "types": [
    {
      "name": "attestation",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "schema",
            "docs": [
              "Schema UID (PDA) associated with this attestation."
            ],
            "type": "pubkey"
          },
          {
            "name": "recipient",
            "docs": [
              "The recipient of the attestation."
            ],
            "type": "pubkey"
          },
          {
            "name": "attester",
            "docs": [
              "The attester who created the attestation."
            ],
            "type": "pubkey"
          },
          {
            "name": "data",
            "docs": [
              "Custom data associated with the attestation."
            ],
            "type": "string"
          },
          {
            "name": "time",
            "docs": [
              "Timestamp of when the attestation was created."
            ],
            "type": "i64"
          },
          {
            "name": "refUid",
            "docs": [
              "Reference to another attestation UID, if any."
            ],
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "expirationTime",
            "docs": [
              "Optional expiration time of the attestation."
            ],
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "revocationTime",
            "docs": [
              "Timestamp of when the attestation was revoked, if revoked."
            ],
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "revocable",
            "docs": [
              "Indicates whether the attestation is revocable."
            ],
            "type": "bool"
          },
          {
            "name": "uid",
            "docs": [
              "Unique identifier (PDA) of this attestation."
            ],
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "attested",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "schema",
            "docs": [
              "Schema UID associated with the attestation."
            ],
            "type": "pubkey"
          },
          {
            "name": "recipient",
            "docs": [
              "The recipient of the attestation."
            ],
            "type": "pubkey"
          },
          {
            "name": "attester",
            "docs": [
              "The attester who created the attestation."
            ],
            "type": "pubkey"
          },
          {
            "name": "uid",
            "docs": [
              "Unique identifier (PDA) of the attestation."
            ],
            "type": "pubkey"
          },
          {
            "name": "time",
            "docs": [
              "Timestamp of when the attestation was created."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "revoked",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "schema",
            "docs": [
              "Schema UID associated with the attestation."
            ],
            "type": "pubkey"
          },
          {
            "name": "recipient",
            "docs": [
              "The recipient of the attestation."
            ],
            "type": "pubkey"
          },
          {
            "name": "attester",
            "docs": [
              "The attester who revoked the attestation."
            ],
            "type": "pubkey"
          },
          {
            "name": "uid",
            "docs": [
              "Unique identifier (PDA) of the attestation."
            ],
            "type": "pubkey"
          },
          {
            "name": "time",
            "docs": [
              "Timestamp of when the attestation was revoked."
            ],
            "type": "i64"
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
