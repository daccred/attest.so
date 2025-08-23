// /**
//  * Revocable Attestations Demo
//  * 
//  * Demonstrates creating revocable attestations, revocation operations,
//  * and revocation status checking features.
//  */

// import StellarAttestProtocol, { 
//   StellarSchemaEncoder, 
//   StellarSchemaRegistry, 
//   StellarDataType,
//   _internal 
// } from '../src'

// async function demonstrateRevocableAttestations() {
//   console.log('🔧 Revocable Attestations Demo')
//   console.log('==============================\n')

//   const attest = new StellarAttestProtocol({
//     secretKeyOrCustomSigner: process.env.SECRET_KEY || 'YOUR_SECRET_KEY',
//     publicKey: process.env.PUBLIC_KEY || 'YOUR_PUBLIC_KEY',
//     contractId: process.env.CONTRACT_ID || 'ATTEST_PROTOCOL_CONTRACT_ID',
//     rpcUrl: 'https://soroban-testnet.stellar.org'
//   })

//   const testKeypairs = _internal.createTestKeypairs()

//   // 1. Creating Revocable Schema
//   console.log('📋 Feature 1: Creating Revocable Schema')
//   console.log('=======================================')

//   const revocableSchema = new StellarSchemaEncoder({
//     name: 'Revocable Verification',
//     version: '1.0.0',
//     description: 'A verification that can be revoked by the issuer',
//     fields: [
//       { name: 'subjectAddress', type: StellarDataType.ADDRESS },
//       { name: 'verificationLevel', type: StellarDataType.STRING },
//       { name: 'issuedDate', type: StellarDataType.TIMESTAMP },
//       { name: 'reason', type: StellarDataType.STRING }
//     ],
//     metadata: {
//       revocable: true,
//       category: 'verification'
//     }
//   })

//   console.log(`✅ Revocable schema created: ${revocableSchema.getSchema().name}`)
//   console.log(`   Revocable: ${revocableSchema.getSchema().metadata?.revocable}`)
//   console.log(`   Hash: ${revocableSchema.getSchemaHash().substring(0, 16)}...\n`)

//   // 2. Creating Revocable Attestations
//   console.log('📝 Feature 2: Creating Revocable Attestations')
//   console.log('=============================================')

//   const attestationData = {
//     subjectAddress: testKeypairs.recipientPublic,
//     verificationLevel: 'standard',
//     issuedDate: Date.now(),
//     reason: 'Identity verification completed'
//   }

//   const attestation1 = await attest.attest(
//     revocableSchema,
//     testKeypairs.recipientPublic,
//     attestationData
//   )

//   console.log(`✅ Revocable attestation created: ${attestation1.id}`)
//   console.log(`   Subject: ${attestation1.subject}`)
//   console.log(`   Revocable: ${attestation1.revocable}`)
//   console.log(`   Status: ${attestation1.revoked ? 'Revoked' : 'Active'}\n`)

//   // Create multiple revocable attestations
//   const attestation2 = await attest.attest(
//     revocableSchema,
//     testKeypairs.recipientPublic,
//     {
//       ...attestationData,
//       verificationLevel: 'enhanced',
//       reason: 'Enhanced verification completed'
//     }
//   )

//   const attestation3 = await attest.attest(
//     revocableSchema,
//     testKeypairs.issuer,
//     {
//       ...attestationData,
//       subjectAddress: testKeypairs.issuer,
//       verificationLevel: 'basic',
//       reason: 'Basic verification completed'
//     }
//   )

//   console.log(`✅ Created ${[attestation1, attestation2, attestation3].length} revocable attestations\n`)

//   // 3. Checking Revocation Status
//   console.log('🔍 Feature 3: Checking Revocation Status')
//   console.log('========================================')

//   // Check individual attestation status
//   const status1 = await attest.isRevoked(attestation1.id)
//   console.log(`Attestation 1 revoked: ${status1}`)

//   const status2 = await attest.isRevoked(attestation2.id)
//   console.log(`Attestation 2 revoked: ${status2}`)

//   const status3 = await attest.isRevoked(attestation3.id)
//   console.log(`Attestation 3 revoked: ${status3}\n`)

//   // 4. Revoking Attestations
//   console.log('❌ Feature 4: Revoking Attestations')
//   console.log('==================================')

//   // Revoke with simple reason
//   await attest.revoke(attestation1.id, 'Verification no longer valid')
//   console.log(`✅ Revoked attestation 1: ${attestation1.id}`)

//   // Revoke with detailed metadata
//   await attest.revoke(attestation2.id, 'Security breach detected', {
//     revokedBy: 'Security Team',
//     severity: 'high',
//     additionalInfo: 'Compromised credentials detected'
//   })
//   console.log(`✅ Revoked attestation 2: ${attestation2.id} (with metadata)`)

//   // Keep attestation3 active for comparison
//   console.log(`ℹ️ Keeping attestation 3 active for comparison\n`)

//   // 5. Verifying Revocation Status After Revocation
//   console.log('✔️ Feature 5: Post-Revocation Status Verification')
//   console.log('================================================')

//   const newStatus1 = await attest.isRevoked(attestation1.id)
//   console.log(`Attestation 1 now revoked: ${newStatus1}`)

//   const newStatus2 = await attest.isRevoked(attestation2.id)
//   console.log(`Attestation 2 now revoked: ${newStatus2}`)

//   const newStatus3 = await attest.isRevoked(attestation3.id)
//   console.log(`Attestation 3 still active: ${!newStatus3}\n`)

//   // 6. Retrieving Revocation Details
//   console.log('📄 Feature 6: Retrieving Revocation Details')
//   console.log('===========================================')

//   const revocationInfo1 = await attest.getRevocationInfo(attestation1.id)
//   if (revocationInfo1) {
//     console.log(`Attestation 1 revocation details:`)
//     console.log(`  Reason: ${revocationInfo1.reason}`)
//     console.log(`  Revoked at: ${new Date(revocationInfo1.revokedAt).toISOString()}`)
//     console.log(`  Revoked by: ${revocationInfo1.revokedBy}`)
//   }

//   const revocationInfo2 = await attest.getRevocationInfo(attestation2.id)
//   if (revocationInfo2) {
//     console.log(`Attestation 2 revocation details:`)
//     console.log(`  Reason: ${revocationInfo2.reason}`)
//     console.log(`  Revoked at: ${new Date(revocationInfo2.revokedAt).toISOString()}`)
//     console.log(`  Metadata: ${JSON.stringify(revocationInfo2.metadata, null, 2)}`)
//   }

//   console.log('')

//   // 7. Batch Revocation Operations
//   console.log('🔄 Feature 7: Batch Revocation Operations')
//   console.log('=========================================')

//   // Create multiple attestations for batch testing
//   const batchAttestations = []
//   for (let i = 0; i < 3; i++) {
//     const att = await attest.attest(
//       revocableSchema,
//       testKeypairs.recipientPublic,
//       {
//         ...attestationData,
//         reason: `Batch test attestation ${i + 1}`
//       }
//     )
//     batchAttestations.push(att)
//   }

//   console.log(`✅ Created ${batchAttestations.length} attestations for batch revocation`)

//   // Batch revoke
//   const batchIds = batchAttestations.map(att => att.id)
//   await attest.revokeBatch(batchIds, 'Batch revocation test')
//   console.log(`✅ Batch revoked ${batchIds.length} attestations`)

//   // Verify batch revocation
//   const batchStatuses = await Promise.all(
//     batchIds.map(id => attest.isRevoked(id))
//   )
//   console.log(`✅ All batch attestations revoked: ${batchStatuses.every(status => status)}\n`)

//   // 8. Revocation Queries and Filtering
//   console.log('🔎 Feature 8: Revocation Queries and Filtering')
//   console.log('==============================================')

//   // Get all attestations for subject (including revoked)
//   const allSubjectAttestations = await attest.listAttestationsBySubject(
//     testKeypairs.recipientPublic,
//     { includeRevoked: true }
//   )
//   console.log(`Total attestations for subject: ${allSubjectAttestations.length}`)

//   // Get only active attestations
//   const activeAttestations = await attest.listAttestationsBySubject(
//     testKeypairs.recipientPublic,
//     { includeRevoked: false }
//   )
//   console.log(`Active attestations for subject: ${activeAttestations.length}`)

//   // Get only revoked attestations
//   const revokedAttestations = allSubjectAttestations.filter(att => att.revoked)
//   console.log(`Revoked attestations for subject: ${revokedAttestations.length}`)

//   // Show revocation summary
//   console.log(`\nRevocation Summary:`)
//   revokedAttestations.forEach((att, index) => {
//     console.log(`  ${index + 1}. ID: ${att.id.substring(0, 16)}... | Reason: ${att.revocationReason || 'N/A'}`)
//   })
//   console.log('')

//   // 9. Revocation Event Monitoring
//   console.log('📡 Feature 9: Revocation Event Monitoring')
//   console.log('=========================================')

//   // Set up revocation event listener
//   const eventListener = (event: any) => {
//     console.log(`🔔 Revocation event detected:`)
//     console.log(`   Attestation: ${event.attestationId}`)
//     console.log(`   Reason: ${event.reason}`)
//     console.log(`   Timestamp: ${new Date(event.timestamp).toISOString()}`)
//   }

//   attest.onRevocation(eventListener)
//   console.log(`✅ Revocation event listener set up`)

//   // Trigger a revocation to test the listener
//   const testAttestation = await attest.attest(
//     revocableSchema,
//     testKeypairs.recipientPublic,
//     {
//       ...attestationData,
//       reason: 'Event monitoring test'
//     }
//   )

//   await attest.revoke(testAttestation.id, 'Testing event monitoring')
//   console.log(`✅ Test revocation completed (check for event above)\n`)

//   // 10. Revocation Analytics
//   console.log('📊 Feature 10: Revocation Analytics')
//   console.log('===================================')

//   const analytics = await attest.getRevocationAnalytics({
//     timeRange: '24h',
//     schemaId: revocableSchema.getSchemaHash()
//   })

//   console.log(`Revocation Analytics (24h):`)
//   console.log(`  Total revocations: ${analytics.totalRevocations}`)
//   console.log(`  Revocation rate: ${analytics.revocationRate}%`)
//   console.log(`  Most common reason: ${analytics.topReasons[0]?.reason || 'N/A'}`)
//   console.log(`  Peak revocation hour: ${analytics.peakHour || 'N/A'}`)
//   console.log(`  Avg time to revocation: ${analytics.avgTimeToRevocation}ms`)

//   console.log('\n🎉 Revocable Attestations Demo Complete!')
//   console.log('=======================================')
//   console.log('Features demonstrated:')
//   console.log('• Creating schemas with revocable metadata')
//   console.log('• Creating revocable attestations')
//   console.log('• Checking revocation status (individual and batch)')
//   console.log('• Revoking attestations with reasons and metadata')
//   console.log('• Retrieving detailed revocation information')
//   console.log('• Batch revocation operations')
//   console.log('• Filtering queries by revocation status')
//   console.log('• Real-time revocation event monitoring')
//   console.log('• Revocation analytics and reporting')
//   console.log('• Complete attestation lifecycle management')
// }

// // Run the demo
// demonstrateRevocableAttestations().catch(console.error)

export {}