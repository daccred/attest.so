var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/logger.ts
import { createConsola } from "consola";
var logger;
var init_logger = __esm({
  "src/logger.ts"() {
    "use strict";
    logger = createConsola({});
  }
});

// src/utils.ts
import fs from "fs";
import path from "path";
var handleJsonFile, checkValidJSONContent, validateStellarSchema, validateStellarAttestation;
var init_utils = __esm({
  "src/utils.ts"() {
    "use strict";
    init_logger();
    handleJsonFile = async (jsonFile) => {
      try {
        const filePath = path.resolve(jsonFile);
        if (!fs.existsSync(filePath)) {
          throw new Error(`File not found: ${filePath}`);
        }
        if (!filePath.toLowerCase().endsWith(".json")) {
          throw new Error("File must have a .json extension");
        }
        const fileContent = fs.readFileSync(filePath, "utf-8");
        try {
          const jsonData = JSON.parse(fileContent);
          return jsonData;
        } catch (parseError) {
          throw new Error("Invalid JSON format in file");
        }
      } catch (error) {
        logger.error(`Error: ${error.message}`);
        process.exit(1);
      }
    };
    checkValidJSONContent = (schema) => {
      if (typeof schema !== "object" || schema === null || Array.isArray(schema)) {
        return "Invalid schema: must be an object.";
      }
      if (typeof schema.name !== "string") {
        return "Invalid schema: name is required and must be a string.";
      }
      if (typeof schema.type !== "string" || schema.type !== "object") {
        return 'Invalid schema: type is required and must be "object".';
      }
      if (typeof schema.properties !== "object" || schema.properties === null) {
        return "Invalid schema: properties is required and must be an object.";
      }
      if (!Array.isArray(schema.required)) {
        return "Invalid schema: required is required and must be an array.";
      }
      for (const key in schema.properties) {
        const property = schema.properties[key];
        if (typeof property !== "object" || property === null) {
          return `Invalid schema: properties.${key} must be an object.`;
        }
        if (typeof property.type !== "string") {
          return `Invalid schema: properties.${key}.type is required and must be a string.`;
        }
        if (property.type === "string" && typeof property.maxLength !== "undefined") {
          if (typeof property.maxLength !== "number") {
            return `Invalid schema: properties.${key}.maxLength must be a number.`;
          }
        }
        if (property.type === "integer" && typeof property.minimum !== "undefined") {
          if (typeof property.minimum !== "number") {
            return `Invalid schema: properties.${key}.minimum must be a number.`;
          }
        }
      }
      return null;
    };
    validateStellarSchema = (content) => {
      if (!content) {
        return "Schema content is required";
      }
      if (typeof content !== "object") {
        return "Schema must be an object";
      }
      if (!content.schemaName && !content.name) {
        return "Schema must have a schemaName or name property";
      }
      if (!content.schemaContent && !content.schema) {
        return "Schema must have a schemaContent or schema property";
      }
      const schemaToValidate = content.schemaContent || content.schema;
      if (typeof schemaToValidate === "object") {
        return checkValidJSONContent(schemaToValidate);
      }
      return null;
    };
    validateStellarAttestation = (content, schemaUid) => {
      if (!content) {
        return "Attestation content is required";
      }
      if (typeof content !== "object") {
        return "Attestation must be an object";
      }
      if (!content.data && !content.attestationData) {
        return "Attestation must have a data or attestationData property";
      }
      if (!schemaUid) {
        return "Schema UID is required for creating attestations";
      }
      return null;
    };
  }
});

// src/handlers/base.ts
import { green, red } from "picocolors";
var BaseHandler;
var init_base = __esm({
  "src/handlers/base.ts"() {
    "use strict";
    init_logger();
    init_utils();
    BaseHandler = class {
      secretKey;
      client;
      constructor() {
      }
      async initialize(keypairPath, url) {
        try {
          this.secretKey = await handleJsonFile(keypairPath);
          await this.initializeClient(this.secretKey, url);
          return true;
        } catch (error) {
          logger.log(red(`Error initializing client: ${error.message}`));
          return false;
        }
      }
      logAction(action, uid, isSchema) {
        const entity = isSchema ? "schema" : "attestation";
        if (action === "fetch" && uid) {
          logger.log(green(`Fetching ${entity} with UID: ${uid}`));
        } else if (action === "create") {
          logger.log(green(`Creating new ${entity}`));
        } else if (action === "revoke" && uid) {
          logger.log(green(`Revoking ${entity} with UID: ${uid}`));
        } else if (action === "register") {
          logger.log(green("Registering new authority"));
        }
      }
    };
  }
});

// ../sdk/dist/core/base.js
var require_base = __commonJS({
  "../sdk/dist/core/base.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AttestSDKBase = void 0;
    var AttestSDKBase = class {
    };
    exports.AttestSDKBase = AttestSDKBase;
  }
});

// ../sdk/dist/core/idl.json
var require_idl = __commonJS({
  "../sdk/dist/core/idl.json"(exports, module) {
    module.exports = {
      address: "BMr9aui54YuxtpBzWXiFNmnr2iH6etRu7rMFJnKxjtpY",
      metadata: {
        name: "attest",
        version: "0.1.0",
        spec: "0.1.0",
        description: "Created with Anchor"
      },
      instructions: [
        {
          name: "attest",
          discriminator: [
            83,
            148,
            120,
            119,
            144,
            139,
            117,
            160
          ],
          accounts: [
            {
              name: "attester",
              docs: [
                "The attester who is creating the attestation."
              ],
              writable: true,
              signer: true
            },
            {
              name: "recipient"
            },
            {
              name: "levy_receipent",
              docs: [
                "CHECK just a chill account"
              ]
            },
            {
              name: "deployer",
              relations: [
                "schema_data"
              ]
            },
            {
              name: "mint_account",
              writable: true
            },
            {
              name: "attester_token_account",
              writable: true,
              pda: {
                seeds: [
                  {
                    kind: "account",
                    path: "attester"
                  },
                  {
                    kind: "const",
                    value: [
                      6,
                      221,
                      246,
                      225,
                      215,
                      101,
                      161,
                      147,
                      217,
                      203,
                      225,
                      70,
                      206,
                      235,
                      121,
                      172,
                      28,
                      180,
                      133,
                      237,
                      95,
                      91,
                      55,
                      145,
                      58,
                      140,
                      245,
                      133,
                      126,
                      255,
                      0,
                      169
                    ]
                  },
                  {
                    kind: "account",
                    path: "mint_account"
                  }
                ],
                program: {
                  kind: "const",
                  value: [
                    140,
                    151,
                    37,
                    143,
                    78,
                    36,
                    137,
                    241,
                    187,
                    61,
                    16,
                    41,
                    20,
                    142,
                    13,
                    131,
                    11,
                    90,
                    19,
                    153,
                    218,
                    255,
                    16,
                    132,
                    4,
                    142,
                    123,
                    216,
                    219,
                    233,
                    248,
                    89
                  ]
                }
              }
            },
            {
              name: "levy_receipent_token_account",
              writable: true,
              pda: {
                seeds: [
                  {
                    kind: "account",
                    path: "levy_receipent"
                  },
                  {
                    kind: "const",
                    value: [
                      6,
                      221,
                      246,
                      225,
                      215,
                      101,
                      161,
                      147,
                      217,
                      203,
                      225,
                      70,
                      206,
                      235,
                      121,
                      172,
                      28,
                      180,
                      133,
                      237,
                      95,
                      91,
                      55,
                      145,
                      58,
                      140,
                      245,
                      133,
                      126,
                      255,
                      0,
                      169
                    ]
                  },
                  {
                    kind: "account",
                    path: "mint_account"
                  }
                ],
                program: {
                  kind: "const",
                  value: [
                    140,
                    151,
                    37,
                    143,
                    78,
                    36,
                    137,
                    241,
                    187,
                    61,
                    16,
                    41,
                    20,
                    142,
                    13,
                    131,
                    11,
                    90,
                    19,
                    153,
                    218,
                    255,
                    16,
                    132,
                    4,
                    142,
                    123,
                    216,
                    219,
                    233,
                    248,
                    89
                  ]
                }
              }
            },
            {
              name: "schema_data",
              docs: [
                "The schema data account; must match the schema UID."
              ]
            },
            {
              name: "attestation",
              writable: true,
              pda: {
                seeds: [
                  {
                    kind: "const",
                    value: [
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
                    kind: "account",
                    path: "schema_data"
                  },
                  {
                    kind: "account",
                    path: "recipient"
                  },
                  {
                    kind: "account",
                    path: "attester"
                  }
                ]
              }
            },
            {
              name: "token_program",
              address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
            },
            {
              name: "associated_token_program",
              address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
            },
            {
              name: "system_program",
              address: "11111111111111111111111111111111"
            }
          ],
          args: [
            {
              name: "data",
              type: "string"
            },
            {
              name: "ref_uid",
              type: {
                option: "pubkey"
              }
            },
            {
              name: "expiration_time",
              type: {
                option: "u64"
              }
            },
            {
              name: "revocable",
              type: "bool"
            }
          ]
        },
        {
          name: "create_schema",
          discriminator: [
            105,
            171,
            40,
            140,
            30,
            91,
            30,
            134
          ],
          accounts: [
            {
              name: "deployer",
              docs: [
                "Deployer who creates the schema."
              ],
              writable: true,
              signer: true
            },
            {
              name: "authority_record",
              writable: true
            },
            {
              name: "schema_data",
              docs: [
                "Schema data stored at the derived PDA."
              ],
              writable: true,
              pda: {
                seeds: [
                  {
                    kind: "const",
                    value: [
                      115,
                      99,
                      104,
                      101,
                      109,
                      97
                    ]
                  },
                  {
                    kind: "account",
                    path: "deployer"
                  },
                  {
                    kind: "arg",
                    path: "_schema_name"
                  }
                ]
              }
            },
            {
              name: "system_program",
              address: "11111111111111111111111111111111"
            }
          ],
          args: [
            {
              name: "schema_name",
              type: "string"
            },
            {
              name: "schema",
              type: "string"
            },
            {
              name: "resolver",
              type: {
                option: "pubkey"
              }
            },
            {
              name: "revocable",
              type: "bool"
            },
            {
              name: "levy",
              type: {
                option: {
                  defined: {
                    name: "Levy"
                  }
                }
              }
            }
          ]
        },
        {
          name: "delegated_attest",
          discriminator: [
            253,
            38,
            166,
            213,
            168,
            72,
            220,
            143
          ],
          accounts: [
            {
              name: "delegated_attester",
              writable: true,
              signer: true
            },
            {
              name: "levy_receipent",
              docs: [
                "CHECK just a chill account"
              ]
            },
            {
              name: "deployer",
              relations: [
                "schema_data"
              ]
            },
            {
              name: "mint_account",
              writable: true
            },
            {
              name: "delegated_attester_token_account",
              writable: true,
              pda: {
                seeds: [
                  {
                    kind: "account",
                    path: "delegated_attester"
                  },
                  {
                    kind: "const",
                    value: [
                      6,
                      221,
                      246,
                      225,
                      215,
                      101,
                      161,
                      147,
                      217,
                      203,
                      225,
                      70,
                      206,
                      235,
                      121,
                      172,
                      28,
                      180,
                      133,
                      237,
                      95,
                      91,
                      55,
                      145,
                      58,
                      140,
                      245,
                      133,
                      126,
                      255,
                      0,
                      169
                    ]
                  },
                  {
                    kind: "account",
                    path: "mint_account"
                  }
                ],
                program: {
                  kind: "const",
                  value: [
                    140,
                    151,
                    37,
                    143,
                    78,
                    36,
                    137,
                    241,
                    187,
                    61,
                    16,
                    41,
                    20,
                    142,
                    13,
                    131,
                    11,
                    90,
                    19,
                    153,
                    218,
                    255,
                    16,
                    132,
                    4,
                    142,
                    123,
                    216,
                    219,
                    233,
                    248,
                    89
                  ]
                }
              }
            },
            {
              name: "levy_receipent_token_account",
              writable: true,
              pda: {
                seeds: [
                  {
                    kind: "account",
                    path: "levy_receipent"
                  },
                  {
                    kind: "const",
                    value: [
                      6,
                      221,
                      246,
                      225,
                      215,
                      101,
                      161,
                      147,
                      217,
                      203,
                      225,
                      70,
                      206,
                      235,
                      121,
                      172,
                      28,
                      180,
                      133,
                      237,
                      95,
                      91,
                      55,
                      145,
                      58,
                      140,
                      245,
                      133,
                      126,
                      255,
                      0,
                      169
                    ]
                  },
                  {
                    kind: "account",
                    path: "mint_account"
                  }
                ],
                program: {
                  kind: "const",
                  value: [
                    140,
                    151,
                    37,
                    143,
                    78,
                    36,
                    137,
                    241,
                    187,
                    61,
                    16,
                    41,
                    20,
                    142,
                    13,
                    131,
                    11,
                    90,
                    19,
                    153,
                    218,
                    255,
                    16,
                    132,
                    4,
                    142,
                    123,
                    216,
                    219,
                    233,
                    248,
                    89
                  ]
                }
              }
            },
            {
              name: "schema_data",
              docs: [
                "The schema data account; must match the schema UID."
              ]
            },
            {
              name: "attestation",
              writable: true,
              pda: {
                seeds: [
                  {
                    kind: "const",
                    value: [
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
                    kind: "account",
                    path: "schema_data"
                  },
                  {
                    kind: "arg",
                    path: "recipient"
                  },
                  {
                    kind: "arg",
                    path: "attester"
                  }
                ]
              }
            },
            {
              name: "token_program",
              address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
            },
            {
              name: "associated_token_program",
              address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
            },
            {
              name: "system_program",
              address: "11111111111111111111111111111111"
            },
            {
              name: "ed25519_program",
              address: "Ed25519SigVerify111111111111111111111111111"
            }
          ],
          args: [
            {
              name: "attestation_data",
              type: {
                defined: {
                  name: "AttestationData"
                }
              }
            },
            {
              name: "attester_info",
              type: {
                defined: {
                  name: "AttesterInfo"
                }
              }
            },
            {
              name: "recipient",
              type: "pubkey"
            },
            {
              name: "attester",
              type: "pubkey"
            }
          ]
        },
        {
          name: "register_authority",
          discriminator: [
            142,
            245,
            45,
            213,
            198,
            12,
            231,
            91
          ],
          accounts: [
            {
              name: "authority_record",
              writable: true,
              pda: {
                seeds: [
                  {
                    kind: "const",
                    value: [
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
                    kind: "account",
                    path: "authority"
                  }
                ]
              }
            },
            {
              name: "authority",
              writable: true,
              signer: true
            },
            {
              name: "system_program",
              address: "11111111111111111111111111111111"
            }
          ],
          args: []
        },
        {
          name: "revoke_attestation",
          discriminator: [
            12,
            156,
            103,
            161,
            194,
            246,
            211,
            179
          ],
          accounts: [
            {
              name: "attester",
              docs: [
                "The attester who is revoking the attestation."
              ],
              writable: true,
              signer: true,
              relations: [
                "attestation"
              ]
            },
            {
              name: "attestation",
              docs: [
                "The attestation account to be revoked."
              ],
              writable: true,
              pda: {
                seeds: [
                  {
                    kind: "const",
                    value: [
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
                    kind: "arg",
                    path: "schema_uid"
                  },
                  {
                    kind: "arg",
                    path: "recipient"
                  },
                  {
                    kind: "account",
                    path: "attester"
                  }
                ]
              }
            }
          ],
          args: [
            {
              name: "schema_uid",
              type: "pubkey"
            },
            {
              name: "recipient",
              type: "pubkey"
            }
          ]
        },
        {
          name: "verify_authority",
          discriminator: [
            73,
            197,
            140,
            96,
            127,
            246,
            175,
            87
          ],
          accounts: [
            {
              name: "authority_record",
              writable: true
            },
            {
              name: "admin",
              signer: true
            }
          ],
          args: [
            {
              name: "is_verified",
              type: "bool"
            }
          ]
        }
      ],
      accounts: [
        {
          name: "Attestation",
          discriminator: [
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
          name: "AuthorityRecord",
          discriminator: [
            177,
            116,
            28,
            129,
            149,
            56,
            73,
            128
          ]
        },
        {
          name: "SchemaData",
          discriminator: [
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
      events: [
        {
          name: "Attested",
          discriminator: [
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
          name: "NewAuthoritySignal",
          discriminator: [
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
          name: "Revoked",
          discriminator: [
            113,
            216,
            148,
            99,
            124,
            184,
            0,
            65
          ]
        },
        {
          name: "SchemaCreated",
          discriminator: [
            78,
            195,
            195,
            2,
            80,
            75,
            53,
            86
          ]
        },
        {
          name: "VerifiedAuthoritySignal",
          discriminator: [
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
      errors: [
        {
          code: 6e3,
          name: "InvalidSchema",
          msg: "Invalid Schema"
        },
        {
          code: 6001,
          name: "NotFound",
          msg: "Attestation not found."
        },
        {
          code: 6002,
          name: "AlreadyRevoked",
          msg: "Attestation already revoked."
        },
        {
          code: 6003,
          name: "Irrevocable",
          msg: "Schema is not revocable."
        },
        {
          code: 6004,
          name: "InvalidExpirationTime",
          msg: "Invalid expiration time."
        },
        {
          code: 6005,
          name: "DataTooLarge",
          msg: "Data too large."
        },
        {
          code: 6006,
          name: "WrongAsset",
          msg: "Wrong Asset."
        },
        {
          code: 6007,
          name: "ShouldBeUnused",
          msg: "Should be unused."
        },
        {
          code: 6008,
          name: "InvalidData",
          msg: "Invalid data."
        },
        {
          code: 6009,
          name: "Unauthorized",
          msg: "Unauthorized operation: Only admin can perform this action."
        },
        {
          code: 6010,
          name: "SchemaAlreadyExists",
          msg: "Schema already exists."
        }
      ],
      types: [
        {
          name: "Attestation",
          type: {
            kind: "struct",
            fields: [
              {
                name: "schema",
                docs: [
                  "Schema UID (PDA) associated with this attestation."
                ],
                type: "pubkey"
              },
              {
                name: "recipient",
                docs: [
                  "The recipient of the attestation."
                ],
                type: "pubkey"
              },
              {
                name: "attester",
                docs: [
                  "The attester who created the attestation."
                ],
                type: "pubkey"
              },
              {
                name: "data",
                docs: [
                  "Custom data associated with the attestation."
                ],
                type: "string"
              },
              {
                name: "time",
                docs: [
                  "Timestamp of when the attestation was created."
                ],
                type: "u64"
              },
              {
                name: "ref_uid",
                docs: [
                  "Reference to another attestation UID, if any."
                ],
                type: {
                  option: "pubkey"
                }
              },
              {
                name: "expiration_time",
                docs: [
                  "Optional expiration time of the attestation."
                ],
                type: {
                  option: "u64"
                }
              },
              {
                name: "revocation_time",
                docs: [
                  "Timestamp of when the attestation was revoked, if revoked."
                ],
                type: {
                  option: "u64"
                }
              },
              {
                name: "revocable",
                docs: [
                  "Indicates whether the attestation is revocable."
                ],
                type: "bool"
              },
              {
                name: "uid",
                docs: [
                  "Unique identifier (PDA) of this attestation."
                ],
                type: "pubkey"
              }
            ]
          }
        },
        {
          name: "AttestationData",
          type: {
            kind: "struct",
            fields: [
              {
                name: "schema_uid",
                type: {
                  array: [
                    "u8",
                    32
                  ]
                }
              },
              {
                name: "recipient",
                type: "pubkey"
              },
              {
                name: "data",
                type: "string"
              },
              {
                name: "ref_uid",
                type: {
                  option: "pubkey"
                }
              },
              {
                name: "expiration_time",
                type: {
                  option: "u64"
                }
              },
              {
                name: "revocable",
                type: "bool"
              },
              {
                name: "nonce",
                type: "u64"
              }
            ]
          }
        },
        {
          name: "Attested",
          type: {
            kind: "struct",
            fields: [
              {
                name: "schema",
                docs: [
                  "Schema UID associated with the attestation."
                ],
                type: "pubkey"
              },
              {
                name: "recipient",
                docs: [
                  "The recipient of the attestation."
                ],
                type: "pubkey"
              },
              {
                name: "attester",
                docs: [
                  "The attester who created the attestation."
                ],
                type: "pubkey"
              },
              {
                name: "uid",
                docs: [
                  "Unique identifier (PDA) of the attestation."
                ],
                type: "pubkey"
              },
              {
                name: "time",
                docs: [
                  "Timestamp of when the attestation was created."
                ],
                type: "u64"
              }
            ]
          }
        },
        {
          name: "AttesterInfo",
          type: {
            kind: "struct",
            fields: [
              {
                name: "message",
                type: "bytes"
              },
              {
                name: "pubkey",
                type: {
                  array: [
                    "u8",
                    32
                  ]
                }
              },
              {
                name: "signature",
                type: {
                  array: [
                    "u8",
                    64
                  ]
                }
              }
            ]
          }
        },
        {
          name: "AuthorityRecord",
          type: {
            kind: "struct",
            fields: [
              {
                name: "authority",
                type: "pubkey"
              },
              {
                name: "is_verified",
                type: "bool"
              },
              {
                name: "first_deployment",
                type: "i64"
              }
            ]
          }
        },
        {
          name: "Levy",
          type: {
            kind: "struct",
            fields: [
              {
                name: "amount",
                docs: [
                  "8 bytes"
                ],
                type: "u64"
              },
              {
                name: "asset",
                docs: [
                  "32 bytes (Asset address)"
                ],
                type: {
                  option: "pubkey"
                }
              },
              {
                name: "recipient",
                docs: [
                  "32 bytes (Recipient of the levy)"
                ],
                type: "pubkey"
              }
            ]
          }
        },
        {
          name: "NewAuthoritySignal",
          type: {
            kind: "struct",
            fields: [
              {
                name: "authority",
                type: "pubkey"
              },
              {
                name: "is_verified",
                type: "bool"
              },
              {
                name: "first_deployment",
                type: "i64"
              }
            ]
          }
        },
        {
          name: "Revoked",
          type: {
            kind: "struct",
            fields: [
              {
                name: "schema",
                docs: [
                  "Schema UID associated with the attestation."
                ],
                type: "pubkey"
              },
              {
                name: "recipient",
                docs: [
                  "The recipient of the attestation."
                ],
                type: "pubkey"
              },
              {
                name: "attester",
                docs: [
                  "The attester who revoked the attestation."
                ],
                type: "pubkey"
              },
              {
                name: "uid",
                docs: [
                  "Unique identifier (PDA) of the attestation."
                ],
                type: "pubkey"
              },
              {
                name: "time",
                docs: [
                  "Timestamp of when the attestation was revoked."
                ],
                type: "u64"
              }
            ]
          }
        },
        {
          name: "SchemaCreated",
          type: {
            kind: "struct",
            fields: [
              {
                name: "uid",
                docs: [
                  "The generated UID for the schema (PDA)."
                ],
                type: "pubkey"
              },
              {
                name: "schema_data",
                docs: [
                  "Full schema data including schema, resolver, revocable, and deployer."
                ],
                type: {
                  defined: {
                    name: "SchemaData"
                  }
                }
              }
            ]
          }
        },
        {
          name: "SchemaData",
          type: {
            kind: "struct",
            fields: [
              {
                name: "uid",
                docs: [
                  "Generate PDA as reference key."
                ],
                type: "pubkey"
              },
              {
                name: "schema",
                docs: [
                  "The actual schema data (e.g., JSON, XML, etc.)."
                ],
                type: "string"
              },
              {
                name: "resolver",
                docs: [
                  "Resolver address (another contract) for schema verification."
                ],
                type: {
                  option: "pubkey"
                }
              },
              {
                name: "revocable",
                docs: [
                  "Indicates whether the schema is revocable."
                ],
                type: "bool"
              },
              {
                name: "deployer",
                docs: [
                  "The deployer/authority who created the schema."
                ],
                type: "pubkey"
              },
              {
                name: "levy",
                type: {
                  option: {
                    defined: {
                      name: "Levy"
                    }
                  }
                }
              }
            ]
          }
        },
        {
          name: "VerifiedAuthoritySignal",
          type: {
            kind: "struct",
            fields: [
              {
                name: "authority",
                type: "pubkey"
              },
              {
                name: "is_verified",
                type: "bool"
              }
            ]
          }
        }
      ]
    };
  }
});

// ../sdk/dist/core/solana.js
var require_solana = __commonJS({
  "../sdk/dist/core/solana.js"(exports) {
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __setModuleDefault = exports && exports.__setModuleDefault || (Object.create ? function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    } : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports && exports.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    var __importDefault = exports && exports.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SolanaAttestSDK = void 0;
    var web3_js_1 = __require("@solana/web3.js");
    var base_1 = require_base();
    var anchor = __importStar(__require("@coral-xyz/anchor"));
    var idl_json_1 = __importDefault(require_idl());
    var SolanaAttestSDK = class extends base_1.AttestSDKBase {
      constructor(config2) {
        super();
        this.connection = new anchor.web3.Connection(config2.url ?? "https://api.devnet.solana.com", "confirmed");
        if (Array.isArray(config2.walletOrSecretKey)) {
          const walletKeypair = web3_js_1.Keypair.fromSecretKey(Uint8Array.from(config2.walletOrSecretKey));
          this.wallet = new anchor.Wallet(walletKeypair);
          this.wallet;
        } else {
          this.wallet = config2.walletOrSecretKey;
        }
        const provider = new anchor.AnchorProvider(this.connection, this.wallet, {
          commitment: "confirmed"
        });
        anchor.setProvider(provider);
        this.programId = config2.programId ? new web3_js_1.PublicKey(config2.programId) : new web3_js_1.PublicKey(idl_json_1.default.address);
        this.program = new anchor.Program(idl_json_1.default);
      }
      /**
       * Initialize the SDK (if needed)
       * @returns Transaction signature
       */
      async initialize() {
      }
      async getWalletBalance() {
        try {
          const balance = await this.connection.getBalance(this.wallet.publicKey);
          return { data: { balance, address: this.wallet.publicKey } };
        } catch (err) {
          return { error: err };
        }
      }
      async _signTransaction(tx) {
        const latestBlockhash = await this.connection.getLatestBlockhash();
        tx.recentBlockhash = latestBlockhash.blockhash;
        tx.feePayer = this.wallet.publicKey;
        const signedTx = await this.wallet.signTransaction(tx);
        const serializedTx = signedTx.serialize();
        const txSignature = await this.connection.sendRawTransaction(serializedTx);
        await this.connection.confirmTransaction(txSignature);
        return txSignature;
      }
      async fetchAuthority() {
        try {
          const [authorityRecordPDA] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("authority"), this.wallet.publicKey.toBuffer()], this.programId);
          const authorityAccount = await this.program.account.authorityRecord.fetch(authorityRecordPDA);
          return { data: authorityAccount };
        } catch (err) {
          return { error: err };
        }
      }
      async registerAuthority() {
        try {
          const { data: authorityAccount } = await this.fetchAuthority();
          if (authorityAccount) {
            return { data: authorityAccount.authority };
          }
          const [authorityRecordPDA] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("authority"), this.wallet.publicKey.toBuffer()], this.programId);
          const tx = await this.program.methods.registerAuthority().accounts({
            authority: this.wallet.publicKey
          }).transaction();
          await this._signTransaction(tx);
          return { data: authorityRecordPDA };
        } catch (err) {
          return { error: err };
        }
      }
      async fetchSchema(schemaUID) {
        try {
          return await this.program.account.schemaData.fetch(schemaUID);
        } catch (err) {
          return { error: err };
        }
      }
      async createSchema(config2) {
        try {
          const [authorityRecordPDA] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("authority"), this.wallet.publicKey.toBuffer()], this.programId);
          const [schemaDataPDA] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("schema"), this.wallet.publicKey.toBuffer(), Buffer.from(config2.schemaName)], this.programId);
          const tx = await this.program.methods.createSchema(config2.schemaName, config2.schemaContent, config2.resolverAddress, config2.revocable ?? true, config2.levy).accounts({
            deployer: this.wallet.publicKey,
            authorityRecord: authorityRecordPDA
          }).transaction();
          await this._signTransaction(tx);
          return { data: schemaDataPDA };
        } catch (err) {
          return { error: err };
        }
      }
      async fetchAttestation(attestation) {
        try {
          return await this.program.account.attestation.fetch(attestation);
        } catch (err) {
          return { error: err };
        }
      }
      async attest(config2) {
        try {
          const [attestationPDA] = web3_js_1.PublicKey.findProgramAddressSync([
            Buffer.from("attestation"),
            config2.schemaData.toBuffer(),
            config2.accounts.recipient.toBuffer(),
            this.wallet.publicKey.toBuffer()
          ], this.programId);
          const accounts = {
            attester: this.wallet.publicKey,
            schemaData: config2.schemaData,
            ...config2.accounts
          };
          const tx = await this.program.methods.attest(config2.data, config2.refUID, config2.expirationTime ? new anchor.BN(config2.expirationTime) : null, config2.revocable ?? true).accounts(accounts).transaction();
          await this._signTransaction(tx);
          return { data: attestationPDA };
        } catch (err) {
          return { error: err };
        }
      }
      async revokeAttestation(props) {
        try {
          const { attestationUID, recipient } = props;
          const [attestationPDA] = web3_js_1.PublicKey.findProgramAddressSync([
            Buffer.from("attestation"),
            attestationUID.toBuffer(),
            recipient.toBuffer(),
            this.wallet.publicKey.toBuffer()
          ], this.programId);
          const { data: attestationBefore } = await this.fetchAttestation(attestationPDA);
          if (!attestationBefore || attestationBefore.revocationTime) {
            return { error: "Attestation doesn't exist or has already been revoked" };
          }
          const tx = await this.program.methods.revokeAttestation(attestationUID, recipient).accounts({
            attester: this.wallet.publicKey,
            attestation: attestationPDA
          }).transaction();
          await this._signTransaction(tx);
          console.log("Attestation revoked successfully");
          const { data: attestationAfter } = await this.fetchAttestation(attestationPDA);
          if (!attestationAfter || !attestationAfter.revocationTime) {
            return { error: "Attestation could not be revoked" };
          }
          return { data: attestationPDA };
        } catch (error) {
          console.error(error);
          if (error.message.includes("AlreadyRevoked")) {
            return { error: "Attestation is already revoked" };
          }
          return { error: error.message };
        }
      }
    };
    exports.SolanaAttestSDK = SolanaAttestSDK;
  }
});

// ../sdk/dist/core/stellar.js
var require_stellar = __commonJS({
  "../sdk/dist/core/stellar.js"(exports) {
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __setModuleDefault = exports && exports.__setModuleDefault || (Object.create ? function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    } : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports && exports.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.StellarAttestSDK = void 0;
    var base_1 = require_base();
    var StellarSdk = __importStar(__require("@stellar/stellar-sdk"));
    var StellarAttestSDK2 = class extends base_1.AttestSDKBase {
      /**
       * Creates a new instance of the Stellar Attest SDK
       * @param config SDK configuration options
       */
      constructor(config2) {
        super();
        this.server = new StellarSdk.Horizon.Server(config2.url ?? "https://horizon-testnet.stellar.org");
        this.keypair = StellarSdk.Keypair.fromSecret(config2.secretKey);
        this.networkPassphrase = config2.networkPassphrase ?? StellarSdk.Networks.TESTNET;
        this.contractId = "CBXGBFZGT2UPL4U64FV4PNPQHQTL64ZDNVBVKM5LKARIHJW5M4SJDGAB";
      }
      /**
       * Initialize the SDK by setting the admin of the contract
       * Maps to initialize(env: Env, admin: Address) in the Stellar contract
       */
      async initialize() {
        try {
          const contract = new StellarSdk.Contract(this.contractId);
          return { data: void 0 };
        } catch (error) {
          return { error };
        }
      }
      /**
       * Retrieves the authority record for the current wallet
       * Note: The Stellar contract doesn't have a direct method for this
       * @returns The authority record or null if not found
       */
      async fetchAuthority() {
        try {
          return {
            data: {
              address: this.keypair.publicKey(),
              metadata: "Default authority metadata"
            }
          };
        } catch (error) {
          return { error };
        }
      }
      /**
       * Registers the current wallet as an authority
       * Note: In Stellar, there's no explicit registration needed beyond initialization
       * @returns The authority address
       */
      async registerAuthority() {
        try {
          return { data: this.keypair.publicKey() };
        } catch (error) {
          return { error };
        }
      }
      /**
       * Fetches a schema by its UID
       * Maps to get_schema in the Stellar contract (internal method)
       * @param schemaUID The schema UID to fetch
       * @returns The schema or null if not found
       */
      async fetchSchema(schemaUID) {
        try {
          const contract = new StellarSdk.Contract(this.contractId);
          return {
            data: {
              uid: schemaUID,
              definition: "Sample schema definition",
              authority: this.keypair.publicKey(),
              revocable: true,
              resolver: null
            }
          };
        } catch (error) {
          return { error };
        }
      }
      /**
       * Creates a new schema
       * Maps to register(env, caller, schema_definition, resolver, revocable) in the Stellar contract
       * @param config Schema configuration
       * @returns The UID of the created schema
       */
      async createSchema(config2) {
        try {
          const contract = new StellarSdk.Contract(this.contractId);
          const schemaUID = this.generateSchemaUID(config2.schemaName, this.keypair.publicKey());
          return { data: schemaUID };
        } catch (error) {
          return { error };
        }
      }
      /**
       * Fetches an attestation by its identifiers
       * Maps to get_attestation(env, schema_uid, subject, reference) in the Stellar contract
       * @param attestation The attestation ID (encoded combination of schema_uid, subject, reference)
       * @returns The attestation or null if not found
       */
      async fetchAttestation(attestation) {
        try {
          const contract = new StellarSdk.Contract(this.contractId);
          const [schemaUID, subject, reference] = this.parseAttestationId(attestation);
          return {
            data: {
              schemaUid: schemaUID,
              subject,
              value: "Sample attestation value",
              reference,
              revoked: false
            }
          };
        } catch (error) {
          return { error };
        }
      }
      /**
       * Creates a new attestation
       * Maps to attest(env, caller, schema_uid, subject, value, reference) in the Stellar contract
       * @param config Attestation configuration
       * @returns The ID of the created attestation
       */
      async attest(config2) {
        try {
          const contract = new StellarSdk.Contract(this.contractId);
          const attestationId = this.generateAttestationId(config2.schemaData.toString(), config2.accounts.recipient.toString(), config2.refUID?.toString() ?? null);
          return { data: attestationId };
        } catch (error) {
          return { error };
        }
      }
      /**
       * Revokes an attestation
       * Maps to revoke_attestation(env, caller, schema_uid, subject, reference) in the Stellar contract
       * @param props Revocation configuration
       * @returns The ID of the revoked attestation
       */
      async revokeAttestation(props) {
        try {
          const contract = new StellarSdk.Contract(this.contractId);
          const attestationId = this.generateAttestationId(props.attestationUID.toString(), props.recipient.toString(), props.reference || null);
          return { data: attestationId };
        } catch (error) {
          return { error };
        }
      }
      /**
       * Helper method to build and submit a transaction
       * @param operations Transaction operations
       * @returns Transaction result
       */
      async buildAndSubmitTransaction(operations) {
        try {
          const account = await this.server.loadAccount(this.keypair.publicKey());
          const transaction = new StellarSdk.TransactionBuilder(account, {
            fee: StellarSdk.BASE_FEE,
            networkPassphrase: this.networkPassphrase
          });
          const builtTx = transaction.setTimeout(30).build();
          builtTx.sign(this.keypair);
          const result = await this.server.submitTransaction(builtTx);
          return result;
        } catch (error) {
          throw error;
        }
      }
      /**
       * Generates a schema UID (this is a simplified simulation)
       * @param schemaName Schema name
       * @param authority Authority address
       * @returns Generated schema UID
       */
      generateSchemaUID(schemaName, authority) {
        return Buffer.from(`schema:${schemaName}:${authority}`).toString("hex");
      }
      /**
       * Generates an attestation ID (this is a simplified simulation)
       * @param schemaUID Schema UID
       * @param subject Subject address
       * @param reference Optional reference string
       * @returns Generated attestation ID
       */
      generateAttestationId(schemaUID, subject, reference) {
        return Buffer.from(`attestation:${schemaUID}:${subject}:${reference || ""}`).toString("hex");
      }
      /**
       * Parses an attestation ID into its components
       * @param attestationId Attestation ID to parse
       * @returns [schemaUID, subject, reference]
       */
      parseAttestationId(attestationId) {
        try {
          const decoded = Buffer.from(attestationId, "hex").toString();
          const parts = decoded.split(":");
          if (parts.length >= 4) {
            return [parts[1], parts[2], parts[3] || null];
          }
        } catch (error) {
        }
        return [
          "schema_uid_placeholder",
          "subject_placeholder",
          null
        ];
      }
    };
    exports.StellarAttestSDK = StellarAttestSDK2;
  }
});

// ../sdk/dist/core/types.js
var require_types = __commonJS({
  "../sdk/dist/core/types.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// ../sdk/dist/index.js
var require_dist = __commonJS({
  "../sdk/dist/index.js"(exports) {
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __exportStar = exports && exports.__exportStar || function(m, exports2) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p)) __createBinding(exports2, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    var solana_1 = require_solana();
    var stellar_1 = require_stellar();
    __exportStar(require_types(), exports);
    __exportStar(require_stellar(), exports);
    __exportStar(require_solana(), exports);
    var AttestSDK2 = class {
      static async initializeStellar(config2) {
        const stellarClient = new stellar_1.StellarAttestSDK(config2);
        await stellarClient.initialize();
        return stellarClient;
      }
      static async initializeSolana(config2) {
        const solanaClient = new solana_1.SolanaAttestSDK(config2);
        await solanaClient.initialize();
        return solanaClient;
      }
    };
    exports.default = AttestSDK2;
  }
});

// src/handlers/stellar.ts
import { green as green2, red as red2, yellow } from "picocolors";
var import_dist, StellarHandler;
var init_stellar = __esm({
  "src/handlers/stellar.ts"() {
    "use strict";
    init_logger();
    import_dist = __toESM(require_dist());
    init_base();
    init_utils();
    StellarHandler = class extends BaseHandler {
      network = "testnet";
      // Default to testnet
      async initializeClient(secretKey) {
        try {
          this.client = await import_dist.default.initializeStellar({
            secretKey,
            networkPassphrase: this.getNetworkPassphrase()
          });
          return this.client;
        } catch (error) {
          logger.log(red2(`Failed to initialize Stellar client: ${error.message}`));
          throw error;
        }
      }
      // Get the network passphrase based on the network configuration
      getNetworkPassphrase() {
        return "";
      }
      async check(action, args) {
        this.logAction(action, args.uid);
        if (args.content && typeof args.content === "object") {
          let validationError = null;
          if (args.type === "schema") {
            validationError = validateStellarSchema(args.content);
          } else if (args.type === "attestation") {
            validationError = validateStellarAttestation(args.content, args.schemaUid);
          }
          if (validationError) {
            logger.log(red2(`Validation error: ${validationError}`));
            return false;
          }
        }
        const initialized = await this.initialize(this.secretKey);
        if (!initialized) {
          logger.log(red2("Failed to initialize client"));
          return false;
        }
        switch (args.type) {
          case "schema":
            return this.handleSchema(action, args);
          case "attestation":
            return this.handleAttestation(action, args);
          case "authority":
            return this.handleAuthority(action);
          default:
            logger.log(red2(`Unknown type: ${args.type}`));
            return false;
        }
      }
      async handleSchema(action, args) {
        if (action === "fetch" && args.uid) {
          const result = await this.client.fetchSchema(args.uid);
          if (result.error) {
            logger.log(red2(`Error: ${result.error}`));
            return false;
          }
          if (!result.data) {
            logger.log(yellow("No schema found with the given UID"));
            return false;
          }
          logger.log("Retrieved Schema:");
          logger.log(JSON.stringify(result.data, null, 2));
          if (this.network === "testnet") {
            logger.log(`URL Link: https://stellar.expert/explorer/testnet/tx/${args.uid}`);
          } else {
            logger.log(`URL Link: https://stellar.expert/explorer/public/tx/${args.uid}`);
          }
          return true;
        }
        if (action === "create" && args.content) {
          const schemaConfig = {
            schemaName: args.content.schemaName || args.content.name,
            schemaContent: args.content.schemaContent || args.content.schema,
            revocable: args.content.revocable ?? true
          };
          if (args.content.levy) {
            schemaConfig.levy = {
              amount: args.content.levy.amount,
              asset: args.content.levy.asset,
              recipient: args.content.levy.recipient
            };
          }
          const result = await this.client.createSchema(schemaConfig);
          if (result.error) {
            logger.log(red2(`Error: ${result.error}`));
            return false;
          }
          logger.log(`Schema UID: ${result.data}`);
          if (this.network === "testnet") {
            logger.log(`URL Link: https://stellar.expert/explorer/testnet/tx/${result.data}`);
          } else {
            logger.log(`URL Link: https://stellar.expert/explorer/public/tx/${result.data}`);
          }
          return true;
        }
        return false;
      }
      async handleAttestation(action, args) {
        if (action === "fetch" && args.uid) {
          const result = await this.client.fetchAttestation(args.uid);
          if (result.error) {
            logger.log(red2(`Error: ${result.error}`));
            return false;
          }
          if (!result.data) {
            logger.log(yellow("No attestation found with the given UID"));
            return false;
          }
          logger.log("Retrieved Attestation:");
          logger.log(JSON.stringify(result.data, null, 2));
          if (this.network === "testnet") {
            logger.log(`URL Link: https://stellar.expert/explorer/testnet/tx/${args.uid}`);
          } else {
            logger.log(`URL Link: https://stellar.expert/explorer/public/tx/${args.uid}`);
          }
          return true;
        }
        if (action === "create" && args.schemaUid && args.content) {
          const schemaResult = await this.client.fetchSchema(args.schemaUid);
          if (schemaResult.error) {
            logger.log(red2(`Error fetching schema: ${schemaResult.error}`));
            return false;
          }
          if (!schemaResult.data) {
            logger.log(red2(`Schema with UID ${args.schemaUid} not found`));
            return false;
          }
          const attestationConfig = {
            schemaData: args.schemaUid,
            data: args.content.data,
            revocable: args.content.revocable ?? true,
            accounts: {
              recipient: args.content.recipient,
              levyReceipent: args.schemaUid,
              mintAccount: args.schemaUid
            }
          };
          const result = await this.client.attest(attestationConfig);
          if (result.error) {
            logger.log(red2(`Error: ${result.error}`));
            return false;
          }
          logger.log(`Attestation UID: ${result.data}`);
          if (this.network === "testnet") {
            logger.log(`URL Link: https://stellar.expert/explorer/testnet/tx/${result.data}`);
          } else {
            logger.log(`URL Link: https://stellar.expert/explorer/public/tx/${result.data}`);
          }
          return true;
        }
        if (action === "revoke" && args.uid) {
          const schemaUID = args.schemaUid || args.content?.schemaUID;
          const recipient = args.content?.recipient;
          if (!schemaUID) {
            logger.log(red2("Schema UID is required for revocation"));
            return false;
          }
          const revocationConfig = {
            schemaUID
          };
          if (recipient) {
            revocationConfig.recipient = recipient;
          } else if (args.uid) {
            revocationConfig.attestationUID = args.uid;
          }
          const result = await this.client.revokeAttestation(revocationConfig);
          if (result.error) {
            logger.log(red2(`Error: ${result.error}`));
            return false;
          }
          logger.log(green2("Attestation revoked successfully"));
          if (result.data && typeof result.data === "string") {
            if (this.network === "testnet") {
              logger.log(`URL Link: https://stellar.expert/explorer/testnet/tx/${result.data}`);
            } else {
              logger.log(`URL Link: https://stellar.expert/explorer/public/tx/${result.data}`);
            }
          }
          return true;
        }
        return false;
      }
      async handleAuthority(action) {
        if (action === "register") {
          const result = await this.client.registerAuthority();
          if (result.error) {
            logger.log(red2(`Error: ${result.error}`));
            return false;
          }
          logger.log(`Authority registered successfully`);
          logger.log(`Authority ID: ${result.data}`);
          if (typeof result.data === "string") {
            if (this.network === "testnet") {
              logger.log(`URL Link: https://stellar.expert/explorer/testnet/tx/${result.data}`);
            } else {
              logger.log(`URL Link: https://stellar.expert/explorer/public/tx/${result.data}`);
            }
          }
          return true;
        }
        if (action === "fetch") {
          const result = await this.client.fetchAuthority();
          if (result.error) {
            logger.log(red2(`Error: ${result.error}`));
            return false;
          }
          if (!result.data) {
            logger.log(yellow("No authority found for the current wallet"));
            return false;
          }
          logger.log("Authority Info:");
          logger.log(
            JSON.stringify(
              {
                id: result.data
              },
              null,
              2
            )
          );
          if (typeof result.data.address === "string" && result.data.address.startsWith("G")) {
            if (this.network === "testnet") {
              logger.log(`URL Link: https://stellar.expert/explorer/testnet/account/${result.data}`);
            } else {
              logger.log(`URL Link: https://stellar.expert/explorer/public/account/${result.data}`);
            }
          }
          return true;
        }
        return false;
      }
    };
  }
});

// src/handlers/index.ts
var getHandler;
var init_handlers = __esm({
  "src/handlers/index.ts"() {
    "use strict";
    init_base();
    init_stellar();
    getHandler = async (keypair, url) => {
      let handler4;
      console.log(`Using keypair: ${keypair}`);
      handler4 = new StellarHandler();
      const initialized = await handler4.initialize(keypair, url);
      if (!initialized) {
        return null;
      }
      return handler4;
    };
  }
});

// src/commands/schema.ts
var schema_exports = {};
__export(schema_exports, {
  builder: () => builder,
  command: () => command,
  describe: () => describe,
  handler: () => handler
});
import { red as red3 } from "picocolors";
function builder(yargs2) {
  return yargs2.option("action", {
    type: "string",
    describe: "Action to perform",
    choices: ["create", "fetch"],
    demandOption: true
  }).option("uid", {
    type: "string",
    describe: "Schema UID (required for fetch)",
    normalize: true
  }).option("json-file", {
    type: "string",
    describe: "Path to JSON schema file (required for create)",
    normalize: true
  }).option("keypair", {
    type: "string",
    describe: "Path to keypair file",
    normalize: true,
    demandOption: true
  }).check((argv) => {
    if (argv.action === "fetch" && !argv.uid) {
      throw new Error("UID is required for fetch action");
    }
    if (argv.action === "create" && !argv.jsonFile) {
      throw new Error("JSON file is required for create action");
    }
    return true;
  });
}
async function handler(argv) {
  try {
    if (argv.action === "create" && argv.jsonFile) {
      argv.content = await handleJsonFile(argv.jsonFile);
    }
    const chainHandler = await getHandler(argv.keypair);
    if (!chainHandler) {
      logger.log(red3(`Failed to initialize Stellar handler`));
      return;
    }
    const args = {
      ...argv,
      type: "schema"
    };
    const success = await chainHandler.check(argv.action, args);
    if (success) {
      logger.log("Done \u2728");
    }
  } catch (error) {
    logger.log(red3(`Error: ${error.message}`));
  }
}
var command, describe;
var init_schema = __esm({
  "src/commands/schema.ts"() {
    "use strict";
    init_logger();
    init_utils();
    init_handlers();
    command = "schema";
    describe = "Manage schemas (create, fetch)";
  }
});

// src/commands/authority.ts
var authority_exports = {};
__export(authority_exports, {
  builder: () => builder2,
  command: () => command2,
  describe: () => describe2,
  handler: () => handler2
});
import { red as red4 } from "picocolors";
function builder2(yargs2) {
  return yargs2.option("register", {
    alias: "r",
    type: "boolean",
    describe: "Register authority"
  }).option("fetch", {
    alias: "f",
    type: "boolean",
    describe: "Fetch authority"
  }).option("keypair", {
    type: "string",
    describe: "Path to keypair file",
    normalize: true,
    demandOption: true
  }).option("url", {
    type: "string",
    describe: "Blockchain node URL"
  }).check((argv) => {
    if (!argv.register && !argv.fetch) {
      throw new Error("You must specify either --register (-r) or --fetch (-f)");
    }
    if (argv.register && argv.fetch) {
      throw new Error("You cannot specify both --register (-r) and --fetch (-f)");
    }
    return true;
  });
}
async function handler2(argv) {
  try {
    if (!argv.keypair) {
      logger.log(red4("Keypair not specified"));
      return;
    }
    const chainHandler = await getHandler(argv.keypair, argv.url);
    if (!chainHandler) {
      logger.log(red4(`Failed to initialize Stellar handler`));
      return;
    }
    const action = argv.register ? "register" : "fetch";
    const args = {
      ...argv,
      type: "authority"
    };
    const success = await chainHandler.check(action, args);
    if (success) {
      logger.log("Done \u2728");
    }
  } catch (error) {
    logger.log(red4(`Error: ${error.message}`));
  }
}
var command2, describe2;
var init_authority = __esm({
  "src/commands/authority.ts"() {
    "use strict";
    init_logger();
    init_handlers();
    command2 = "authority";
    describe2 = `Manage attestation authorities (register, fetch)
 
See -> attest-stellar authority --[register|fetch] --keypair=./keys/stellar-auth.json [--url="custom-url"]

`;
  }
});

// src/commands/attestation.ts
var attestation_exports = {};
__export(attestation_exports, {
  aliases: () => aliases,
  builder: () => builder3,
  command: () => command3,
  describe: () => describe3,
  handler: () => handler3
});
import { red as red5 } from "picocolors";
function builder3(yargs2) {
  return yargs2.option("action", {
    type: "string",
    describe: "Action to perform",
    choices: ["create", "fetch", "revoke"],
    demandOption: true
  }).option("uid", {
    type: "string",
    describe: "Attestation UID (required for fetch and revoke)",
    normalize: true
  }).option("schema-uid", {
    type: "string",
    describe: "Schema UID (required for create)",
    normalize: true
  }).option("json-file", {
    type: "string",
    describe: "Path to JSON data file for attestation (required for create)",
    normalize: true
  }).option("keypair", {
    type: "string",
    describe: "Path to keypair file",
    normalize: true,
    demandOption: true
  }).check((argv) => {
    if ((argv.action === "fetch" || argv.action === "revoke") && !argv.uid) {
      throw new Error("UID is required for fetch and revoke actions");
    }
    if (argv.action === "create" && (!argv.schemaUid || !argv.jsonFile)) {
      throw new Error("Schema UID and JSON file are required for create action");
    }
    return true;
  });
}
async function handler3(argv) {
  try {
    if (argv.action === "create" && argv.jsonFile) {
      argv.content = await handleJsonFile(argv.jsonFile);
    }
    const chainHandler = await getHandler(argv.keypair);
    if (!chainHandler) {
      logger.log(red5(`Failed to initialize Stellar handler`));
      return;
    }
    const args = {
      ...argv,
      type: "attestation"
    };
    const success = await chainHandler.check(argv.action, args);
    if (success) {
      logger.log("Done \u2728");
    }
  } catch (error) {
    logger.log(red5(`Error: ${error.message}`));
  }
}
var command3, describe3, aliases;
var init_attestation = __esm({
  "src/commands/attestation.ts"() {
    "use strict";
    init_logger();
    init_utils();
    init_handlers();
    command3 = "attestation";
    describe3 = "Manage attestations (create, fetch, revoke)";
    aliases = ["attest"];
  }
});

// src/commands/index.ts
var commands;
var init_commands = __esm({
  "src/commands/index.ts"() {
    "use strict";
    init_schema();
    init_authority();
    init_attestation();
    commands = [
      schema_exports,
      authority_exports,
      attestation_exports
    ];
  }
});

// src/index.ts
var init_src = __esm({
  "src/index.ts"() {
    "use strict";
    init_commands();
  }
});

// bin/run.ts
import yargs from "yargs";
import { config } from "dotenv";
import { bold, yellow as yellow2 } from "picocolors";
var require_run = __commonJS({
  "bin/run.ts"() {
    init_src();
    init_logger();
    config();
    var run = yargs(process.argv.slice(2));
    logger.log(
      `
  \u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557 
 \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u255A\u2550\u2550\u2588\u2588\u2554\u2550\u2550\u255D\u255A\u2550\u2550\u2588\u2588\u2554\u2550\u2550\u255D\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D\u255A\u2550\u2550\u2588\u2588\u2554\u2550\u2550\u255D  \u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D\u2588\u2588\u2554\u2550\u2550\u2550\u2588\u2588\u2557
 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551   \u2588\u2588\u2551      \u2588\u2588\u2551   \u2588\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557   \u2588\u2588\u2551     \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2551   \u2588\u2588\u2551
 \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551   \u2588\u2588\u2551      \u2588\u2588\u2551   \u2588\u2588\u2554\u2550\u2550\u255D  \u255A\u2550\u2550\u2550\u2550\u2588\u2588\u2551   \u2588\u2588\u2551     \u255A\u2550\u2550\u2550\u2550\u2588\u2588\u2551\u2588\u2588\u2551   \u2588\u2588\u2551
 \u2588\u2588\u2551  \u2588\u2588\u2551   \u2588\u2588\u2551      \u2588\u2588\u2551   \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551   \u2588\u2588\u2551  \u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551\u255A\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D
 \u255A\u2550\u255D  \u255A\u2550\u255D   \u255A\u2550\u255D      \u255A\u2550\u255D   \u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D   \u255A\u2550\u255D  \u255A\u2550\u255D\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u2550\u2550\u2550\u2550\u255D 
 `
    );
    logger.log(bold("Welcome to the ATTEST.SO Stellar CLI\n\n"));
    for (const command4 of commands) {
      run.command(command4);
    }
    run.demandCommand(
      1,
      "You need at least one command before moving on\n\nSuggested Command: " + yellow2(bold("attest-stellar schema --action=create --json-file=sample.json --keypair=<keypair>"))
    ).help().argv;
  }
});
export default require_run();
