/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/authority_resolver.json`.
 */
export type AuthorityResolver = {
  "address": "3pCxP61J8wjJ35ua67VBAgU2VnhWyG4NzrKeoGuY9PRz",
  "metadata": {
    "name": "authorityResolver",
    "version": "0.1.1",
    "spec": "0.1.0",
    "description": "Custom resolver impl we use to create verified authorities on top of our attestations service"
  },
  "instructions": [
    {
      "name": "findOrSetAuthority",
      "discriminator": [
        243,
        53,
        202,
        21,
        4,
        52,
        133,
        31
      ],
      "accounts": [
        {
          "name": "authorityRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
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
      "name": "updateAuthority",
      "discriminator": [
        32,
        46,
        64,
        28,
        149,
        75,
        243,
        88
      ],
      "accounts": [
        {
          "name": "authorityRecord",
          "writable": true
        },
        {
          "name": "admin",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "isVerified",
          "type": "bool"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "authorityRecord",
      "discriminator": [
        177,
        116,
        28,
        129,
        149,
        56,
        73,
        128
      ]
    }
  ],
  "events": [
    {
      "name": "newAuthoritySignal",
      "discriminator": [
        96,
        61,
        229,
        248,
        174,
        134,
        19,
        116
      ]
    },
    {
      "name": "verifiedAuthoritySignal",
      "discriminator": [
        29,
        89,
        201,
        80,
        124,
        83,
        72,
        169
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "Unauthorized operation: Only admin can perform this action."
    }
  ],
  "types": [
    {
      "name": "authorityRecord",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "isVerified",
            "type": "bool"
          },
          {
            "name": "firstDeployment",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "newAuthoritySignal",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "isVerified",
            "type": "bool"
          },
          {
            "name": "firstDeployment",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "verifiedAuthoritySignal",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "isVerified",
            "type": "bool"
          }
        ]
      }
    }
  ]
};
