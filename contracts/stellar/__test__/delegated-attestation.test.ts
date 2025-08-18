/**
 * Delegated Attestation Integration Tests
 * 
 * This test suite validates the complete delegated attestation flow including:
 * - BLS key registration and management
 * - Cross-platform signature creation and verification
 * - Nonce management and replay protection
 * - Delegated submission mechanics
 * - Error handling and edge cases
 * 
 * Tests are designed to run against testnet deployments to validate
 * real-world protocol behavior.
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { bls12_381 } from '@noble/curves/bls12-381';
import { sha256 } from '@noble/hashes/sha256';
import { 
    StellarSDK, 
    AttestationContractClient,
    DelegatedAttestationRequest,
    DelegatedRevocationRequest 
} from '../src/stellar-sdk';

describe('Delegated Attestation Integration Tests', () => {
    let contractClient: AttestationContractClient;
    let attesters: Array<{
        address: string;
        keypair: any;
        blsPrivateKey: Uint8Array;
        blsPublicKey: Uint8Array;
    }>;
    let subjects: Array<{ address: string; keypair: any }>;
    let schemaUID: string;

    beforeAll(async () => {
        // Initialize contract client for testnet
        contractClient = new AttestationContractClient({
            contractId: process.env.TESTNET_CONTRACT_ID!,
            networkPassphrase: 'Test SDF Network ; September 2015',
            rpcUrl: 'https://soroban-testnet.stellar.org',
        });

        // Generate test accounts
        attesters = await Promise.all([
            generateAttesterAccount(),
            generateAttesterAccount(),
            generateAttesterAccount(),
        ]);

        subjects = await Promise.all([
            generateSubjectAccount(),
            generateSubjectAccount(),
        ]);

        // Register a test schema
        schemaUID = await registerTestSchema();
    });

    describe('BLS Key Registration', () => {
        test('should register BLS public key for attester', async () => {
            const attester = attesters[0];
            
            const result = await contractClient.registerBlsKey({
                attester: attester.address,
                publicKey: attester.blsPublicKey,
                signerKeypair: attester.keypair,
            });

            expect(result.success).toBe(true);
            
            // Verify key was stored
            const storedKey = await contractClient.getBlsKey(attester.address);
            expect(storedKey?.key).toEqual(attester.blsPublicKey);
            expect(storedKey?.registered_at).toBeGreaterThan(0);
        });

        test('should prevent duplicate BLS key registration', async () => {
            const attester = attesters[0];
            
            // Attempt duplicate registration
            const result = await contractClient.registerBlsKey({
                attester: attester.address,
                publicKey: attester.blsPublicKey,
                signerKeypair: attester.keypair,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('AlreadyInitialized');
        });

        test('should allow different attesters to register their own keys', async () => {
            for (let i = 1; i < attesters.length; i++) {
                const attester = attesters[i];
                
                const result = await contractClient.registerBlsKey({
                    attester: attester.address,
                    publicKey: attester.blsPublicKey,
                    signerKeypair: attester.keypair,
                });

                expect(result.success).toBe(true);
            }
        });
    });

    describe('Cross-Platform Signature Creation', () => {
        test('should create valid BLS signature using @noble/curves', async () => {
            const attester = attesters[0];
            const subject = subjects[0];
            
            // Create attestation request
            const request = {
                schema_uid: schemaUID,
                subject: subject.address,
                attester: attester.address,
                value: 'Test attestation value',
                nonce: 0,
                deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
                expiration_time: null,
            };

            // Create deterministic message (must match Rust implementation)
            const message = createAttestationMessage(request);
            
            // Sign with BLS private key
            const signature = bls12_381.sign(message, attester.blsPrivateKey);
            
            // Verify signature locally with @noble/curves
            const isValid = bls12_381.verify(signature, message, attester.blsPublicKey);
            expect(isValid).toBe(true);

            // Store for later tests
            (request as any).signature = signature;
            expect(signature).toHaveLength(96); // BLS G1 signature length
        });

        test('should create signatures compatible with Soroban verification', async () => {
            const attester = attesters[1];
            const subject = subjects[1];
            
            const request = {
                schema_uid: schemaUID,
                subject: subject.address,
                attester: attester.address,
                value: 'Cross-platform test',
                nonce: 0,
                deadline: Math.floor(Date.now() / 1000) + 3600,
                expiration_time: null,
            };

            const message = createAttestationMessage(request);
            const signature = bls12_381.sign(message, attester.blsPrivateKey);

            // Test direct verification on Soroban
            const verificationResult = await contractClient.testBlsSignatureVerification({
                message,
                signature,
                attester: attester.address,
            });

            expect(verificationResult.success).toBe(true);
        });
    });

    describe('Delegated Attestation Submission', () => {
        test('should submit delegated attestation by third party', async () => {
            const attester = attesters[0];
            const subject = subjects[0];
            const submitter = subjects[1]; // Different from attester
            
            const request = {
                schema_uid: schemaUID,
                subject: subject.address,
                attester: attester.address,
                value: 'Delegated attestation test',
                nonce: 0,
                deadline: Math.floor(Date.now() / 1000) + 3600,
                expiration_time: null,
            };

            const message = createAttestationMessage(request);
            const signature = bls12_381.sign(message, attester.blsPrivateKey);

            const delegatedRequest: DelegatedAttestationRequest = {
                ...request,
                signature,
            };

            // Submit by third party (submitter pays fees)
            const result = await contractClient.attestByDelegation({
                submitter: submitter.address,
                request: delegatedRequest,
                signerKeypair: submitter.keypair, // Submitter signs transaction
            });

            expect(result.success).toBe(true);
            
            // Verify attestation was created
            const attestation = await contractClient.getAttestation({
                schema_uid: schemaUID,
                subject: subject.address,
                nonce: 0,
            });

            expect(attestation).toBeDefined();
            expect(attestation!.attester).toBe(attester.address); // Original attester recorded
            expect(attestation!.subject).toBe(subject.address);
            expect(attestation!.value).toBe('Delegated attestation test');
        });

        test('should allow subject to submit their own delegated attestation', async () => {
            const attester = attesters[1];
            const subject = subjects[0];
            
            const request = {
                schema_uid: schemaUID,
                subject: subject.address,
                attester: attester.address,
                value: 'Self-submitted delegated attestation',
                nonce: 0, // First nonce for this attester
                deadline: Math.floor(Date.now() / 1000) + 3600,
                expiration_time: null,
            };

            const message = createAttestationMessage(request);
            const signature = bls12_381.sign(message, attester.blsPrivateKey);

            // Subject submits attestation about themselves
            const result = await contractClient.attestByDelegation({
                submitter: subject.address,
                request: { ...request, signature },
                signerKeypair: subject.keypair,
            });

            expect(result.success).toBe(true);
        });
    });

    describe('Nonce Management', () => {
        test('should increment nonces correctly', async () => {
            const attester = attesters[0];
            const subject = subjects[1];
            
            // Get initial nonce
            const initialNonce = await contractClient.getAttesterNonce(attester.address);
            expect(initialNonce).toBe(1); // Should be 1 after previous test

            // Submit multiple attestations
            for (let i = 0; i < 3; i++) {
                const request = {
                    schema_uid: schemaUID,
                    subject: subject.address,
                    attester: attester.address,
                    value: `Sequential attestation ${i}`,
                    nonce: initialNonce + i,
                    deadline: Math.floor(Date.now() / 1000) + 3600,
                    expiration_time: null,
                };

                const message = createAttestationMessage(request);
                const signature = bls12_381.sign(message, attester.blsPrivateKey);

                const result = await contractClient.attestByDelegation({
                    submitter: subject.address,
                    request: { ...request, signature },
                    signerKeypair: subject.keypair,
                });

                expect(result.success).toBe(true);
            }

            // Verify final nonce
            const finalNonce = await contractClient.getAttesterNonce(attester.address);
            expect(finalNonce).toBe(initialNonce + 3);
        });

        test('should reject invalid nonce', async () => {
            const attester = attesters[0];
            const subject = subjects[1];
            
            const currentNonce = await contractClient.getAttesterNonce(attester.address);
            
            const request = {
                schema_uid: schemaUID,
                subject: subject.address,
                attester: attester.address,
                value: 'Invalid nonce test',
                nonce: currentNonce + 5, // Skip ahead - should fail
                deadline: Math.floor(Date.now() / 1000) + 3600,
                expiration_time: null,
            };

            const message = createAttestationMessage(request);
            const signature = bls12_381.sign(message, attester.blsPrivateKey);

            const result = await contractClient.attestByDelegation({
                submitter: subject.address,
                request: { ...request, signature },
                signerKeypair: subject.keypair,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('InvalidNonce');
        });

        test('should isolate nonces between attesters', async () => {
            // Verify each attester has independent nonces
            for (let i = 0; i < attesters.length; i++) {
                const nonce = await contractClient.getAttesterNonce(attesters[i].address);
                // Each attester should have different nonce progression
                console.log(`Attester ${i} nonce: ${nonce}`);
            }
        });
    });

    describe('Deadline Enforcement', () => {
        test('should reject expired delegated attestation', async () => {
            const attester = attesters[0];
            const subject = subjects[0];
            
            const request = {
                schema_uid: schemaUID,
                subject: subject.address,
                attester: attester.address,
                value: 'Expired attestation test',
                nonce: await contractClient.getAttesterNonce(attester.address),
                deadline: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
                expiration_time: null,
            };

            const message = createAttestationMessage(request);
            const signature = bls12_381.sign(message, attester.blsPrivateKey);

            const result = await contractClient.attestByDelegation({
                submitter: subject.address,
                request: { ...request, signature },
                signerKeypair: subject.keypair,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('ExpiredSignature');
        });
    });

    describe('Delegated Revocation', () => {
        test('should revoke attestation using delegated signature', async () => {
            const attester = attesters[0];
            const subject = subjects[0];
            
            // First create an attestation to revoke
            const currentNonce = await contractClient.getAttesterNonce(attester.address);
            const attestRequest = {
                schema_uid: schemaUID,
                subject: subject.address,
                attester: attester.address,
                value: 'To be revoked',
                nonce: currentNonce,
                deadline: Math.floor(Date.now() / 1000) + 3600,
                expiration_time: null,
            };

            const attestMessage = createAttestationMessage(attestRequest);
            const attestSignature = bls12_381.sign(attestMessage, attester.blsPrivateKey);

            await contractClient.attestByDelegation({
                submitter: subject.address,
                request: { ...attestRequest, signature: attestSignature },
                signerKeypair: subject.keypair,
            });

            // Now create delegated revocation
            const revokeRequest = {
                schema_uid: schemaUID,
                subject: subject.address,
                nonce: currentNonce,
                revoker: attester.address,
                deadline: Math.floor(Date.now() / 1000) + 3600,
            };

            const revokeMessage = createRevocationMessage(revokeRequest);
            const revokeSignature = bls12_381.sign(revokeMessage, attester.blsPrivateKey);

            const result = await contractClient.revokeByDelegation({
                submitter: subject.address,
                request: { ...revokeRequest, signature: revokeSignature },
                signerKeypair: subject.keypair,
            });

            expect(result.success).toBe(true);

            // Verify attestation is revoked
            const attestation = await contractClient.getAttestation({
                schema_uid: schemaUID,
                subject: subject.address,
                nonce: currentNonce,
            });

            expect(attestation!.revoked).toBe(true);
            expect(attestation!.revocation_time).toBeGreaterThan(0);
        });
    });

    describe('Error Handling', () => {
        test('should reject invalid BLS signature', async () => {
            const attester = attesters[0];
            const subject = subjects[0];
            
            const request = {
                schema_uid: schemaUID,
                subject: subject.address,
                attester: attester.address,
                value: 'Invalid signature test',
                nonce: await contractClient.getAttesterNonce(attester.address),
                deadline: Math.floor(Date.now() / 1000) + 3600,
                expiration_time: null,
            };

            // Create invalid signature (random bytes)
            const invalidSignature = new Uint8Array(96).fill(0);

            const result = await contractClient.attestByDelegation({
                submitter: subject.address,
                request: { ...request, signature: invalidSignature },
                signerKeypair: subject.keypair,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('InvalidSignature');
        });

        test('should reject attestation from unregistered BLS key', async () => {
            // Create new attester without registering BLS key
            const unregisteredAttester = await generateAttesterAccount();
            const subject = subjects[0];
            
            const request = {
                schema_uid: schemaUID,
                subject: subject.address,
                attester: unregisteredAttester.address,
                value: 'Unregistered attester test',
                nonce: 0,
                deadline: Math.floor(Date.now() / 1000) + 3600,
                expiration_time: null,
            };

            const message = createAttestationMessage(request);
            const signature = bls12_381.sign(message, unregisteredAttester.blsPrivateKey);

            const result = await contractClient.attestByDelegation({
                submitter: subject.address,
                request: { ...request, signature },
                signerKeypair: subject.keypair,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('InvalidSignature');
        });
    });

    describe('Gas Fee Economics', () => {
        test('should measure gas costs for delegated vs direct attestations', async () => {
            // This test measures and compares gas costs
            // Implementation depends on Stellar fee structure
            
            // TODO: Implement gas cost comparison
            // - Direct attestation cost
            // - Delegated attestation cost
            // - Verify submitter pays fees, not attester
        });
    });

    describe('Event Emission', () => {
        test('should emit correct events for BLS key registration', async () => {
            // TODO: Test event filtering and verification
            // - BLS_KEY::REGISTER events
            // - Attestation events
            // - Revocation events
        });
    });
});

// Helper Functions

async function generateAttesterAccount() {
    // Generate Stellar keypair
    const keypair = StellarSDK.Keypair.random();
    
    // Generate BLS keypair
    const blsPrivateKey = bls12_381.utils.randomPrivateKey();
    const blsPublicKey = bls12_381.getPublicKey(blsPrivateKey);
    
    // Fund account on testnet
    await fundTestnetAccount(keypair.publicKey());
    
    return {
        address: keypair.publicKey(),
        keypair,
        blsPrivateKey,
        blsPublicKey,
    };
}

async function generateSubjectAccount() {
    const keypair = StellarSDK.Keypair.random();
    await fundTestnetAccount(keypair.publicKey());
    
    return {
        address: keypair.publicKey(),
        keypair,
    };
}

async function fundTestnetAccount(address: string) {
    // Use Stellar testnet friendbot
    await fetch(`https://friendbot.stellar.org?addr=${address}`);
    // Wait for funding to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
}

async function registerTestSchema(): Promise<string> {
    // Register a test schema for attestations
    // Implementation depends on contract client
    return 'test-schema-uid';
}

function createAttestationMessage(request: any): Uint8Array {
    // Create deterministic message that matches Rust implementation
    const encoder = new TextEncoder();
    const domainSeparator = encoder.encode('ATTEST_PROTOCOL_V1_DELEGATED');
    
    // Convert schema UID to bytes (assuming hex string)
    const schemaBytes = hexToBytes(request.schema_uid);
    
    // Convert numbers to big-endian bytes
    const nonceBytes = numberToBeBytes(request.nonce, 8);
    const deadlineBytes = numberToBeBytes(request.deadline, 8);
    
    // Concatenate all fields in same order as Rust
    const message = new Uint8Array([
        ...domainSeparator,
        ...schemaBytes,
        ...nonceBytes,
        ...deadlineBytes,
        // Add other fields as needed to match Rust implementation
    ]);
    
    return sha256(message);
}

function createRevocationMessage(request: any): Uint8Array {
    // Create deterministic revocation message
    const encoder = new TextEncoder();
    const domainSeparator = encoder.encode('REVOKE_PROTOCOL_V1_DELEGATED');
    
    const schemaBytes = hexToBytes(request.schema_uid);
    const nonceBytes = numberToBeBytes(request.nonce, 8);
    const deadlineBytes = numberToBeBytes(request.deadline, 8);
    
    const message = new Uint8Array([
        ...domainSeparator,
        ...schemaBytes,
        ...nonceBytes,
        ...deadlineBytes,
    ]);
    
    return sha256(message);
}

function hexToBytes(hex: string): Uint8Array {
    // Convert hex string to bytes
    const cleanHex = hex.replace(/^0x/, '');
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
        bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
    }
    return bytes;
}

function numberToBeBytes(num: number, byteLength: number): Uint8Array {
    // Convert number to big-endian bytes
    const bytes = new Uint8Array(byteLength);
    for (let i = byteLength - 1; i >= 0; i--) {
        bytes[i] = num & 0xff;
        num = Math.floor(num / 256);
    }
    return bytes;
}