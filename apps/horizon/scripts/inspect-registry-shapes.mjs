import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { xdr, scValToNative } from '@stellar/stellar-sdk'
import { writeFile } from 'node:fs/promises'

function getType(value) {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

function summarizeObjectShape(value, maxDepth = 2, depth = 0) {
  if (depth >= maxDepth) {
    return getType(value)
  }

  const valueType = getType(value)
  if (valueType === 'array') {
    if (value.length === 0) return 'array<empty>'
    return [`array<${getType(value[0])}>`, summarizeObjectShape(value[0], maxDepth, depth + 1)]
  }

  if (valueType === 'object') {
    const result = {}
    const obj = value
    Object.keys(obj).slice(0, 25).forEach((key) => {
      try {
        result[key] = summarizeObjectShape(obj[key], maxDepth, depth + 1)
      } catch (_err) {
        result[key] = 'unavailable'
      }
    })
    return result
  }

  return valueType
}

function tryDecodeScValBase64(b64) {
  try {
    const sc = xdr.ScVal.fromXDR(b64, 'base64')
    return scValToNative(sc)
  } catch (_e) {
    return null
  }
}

function decodeEventType(rawType) {
  if (!rawType || typeof rawType !== 'string') return { decoded: null, raw: rawType }
  const decoded = tryDecodeScValBase64(rawType)
  return { decoded, raw: rawType }
}

function decodeEventData(rawData) {
  if (!rawData) return { decoded: null, raw: rawData }

  if (Array.isArray(rawData)) {
    const decodedArray = rawData.map((v) => (typeof v === 'string' ? tryDecodeScValBase64(v) : v))
    return { decoded: decodedArray, raw: rawData }
  }

  if (typeof rawData === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(rawData)) {
      if (typeof v === 'string') {
        out[k] = tryDecodeScValBase64(v) ?? v
      } else if (Array.isArray(v)) {
        out[k] = v.map((vv) => (typeof vv === 'string' ? tryDecodeScValBase64(vv) : vv))
      } else {
        out[k] = v
      }
    }
    return { decoded: out, raw: rawData }
  }

  return { decoded: rawData, raw: rawData }
}

function decodeTxEnvelope(b64) {
  if (!b64 || typeof b64 !== 'string' || b64.length === 0) return null
  try {
    const env = xdr.TransactionEnvelope.fromXDR(b64, 'base64')
    const out = {}
    const sw = env.switch()
    const swName = typeof sw.name === 'function' ? sw.name : String(sw)
    out.envelopeType = swName

    const extractOps = (tx) => {
      const ops = tx.operations() || []
      return ops.map((op) => {
        const body = op.body()
        const typeEnum = body.switch()
        const typeName = typeof typeEnum.name === 'function' ? typeEnum.name : String(typeEnum)
        const entry = { type: typeName }
        try {
          if (typeEnum === xdr.OperationType.invokeHostFunction()) {
            const ihf = body.invokeHostFunctionOp()
            const params = ihf.parameters() || []
            entry.parameters = params.map((p) => {
              try {
                return scValToNative(p)
              } catch (_e) {
                return 'unparsed_scval'
              }
            })
            const hf = ihf.hostFunction()
            if (hf) {
              const hfType = hf.switch()
              entry.hostFunctionType = typeof hfType.name === 'function' ? hfType.name : String(hfType)
            }
          }
        } catch (_e) {}
        return entry
      })
    }

    if (env.v1) {
      const v1 = env.v1()
      const tx = v1.tx()
      out.sourceAccount = 'v1'
      out.operations = extractOps(tx)
      return out
    }

    if (env.feeBump) {
      const fb = env.feeBump()
      const inner = fb.innerTx().v1()
      const tx = inner.tx()
      out.sourceAccount = 'feeBump'
      out.operations = extractOps(tx)
      return out
    }

    return { envelopeType: 'unknown' }
  } catch (_e) {
    return null
  }
}

function getHorizonBaseUrl() {
  return process.env.HORIZON_URL || process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org'
}

async function fetchOperationsHttp(transactionHash) {
  const base = getHorizonBaseUrl()
  const url = `${base}/transactions/${transactionHash}/operations?limit=200&order=asc`
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) return []
    const data = await res.json()
    return data._embedded?.records || []
  } catch (_e) {
    return []
  }
}

function normalizeOperationRecord(op) {
  return {
    id: op.id,
    type_i: op.type_i,
    function: op.function || op.details?.function,
    parameters: op.parameters || op.details?.parameters || [],
    source_account: op.source_account,
    transaction_hash: op.transaction_hash,
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set')
    process.exit(1)
  }

  const prisma = new PrismaClient({
    datasources: {
      db: { url: databaseUrl },
    },
  })

  try {
    await prisma.$connect()
    const limitArg = process.argv.find((a) => a.startsWith('--limit='))
    const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 5
    const full = process.argv.includes('--full')
    const outArg = process.argv.find((a) => a.startsWith('--outfile='))
    const outFile = outArg ? outArg.split('=')[1] : null

    console.log('=== Horizon Registry Shape Inspector (ESM) ===')

    const dump = {
      timestamp: new Date().toISOString(),
      eventTypes: [],
      types: [],
      transactionsSampleShape: null,
      operationsSampleShape: null,
    }

    // Event types
    let eventTypeCounts = []
    try {
      eventTypeCounts = await prisma.horizonEvent.groupBy({
        by: ['eventType'],
        _count: { eventType: true },
      })
    } catch (e) {
      const types = await prisma.horizonEvent.findMany({
        select: { eventType: true },
        distinct: ['eventType'],
        take: 100,
      })
      eventTypeCounts = await Promise.all(
        types.map(async (t) => ({
          eventType: t.eventType,
          _count: {
            eventType: await prisma.horizonEvent.count({ where: { eventType: t.eventType } }),
          },
        }))
      )
    }

    console.log('\nEvent types (by count):')
    eventTypeCounts
      .sort((a, b) => b._count.eventType - a._count.eventType)
      .slice(0, 50)
      .forEach((et) => {
        const decoded = decodeEventType(et.eventType)
        console.log(`- ${et.eventType} (decoded: ${JSON.stringify(decoded.decoded)}) => ${et._count.eventType}`)
        dump.eventTypes.push({ raw: et.eventType, decoded: decoded.decoded, count: et._count.eventType })
      })

    // Sample events per type
    const sampleEventTypes = eventTypeCounts.slice(0, Math.min(eventTypeCounts.length, limit))
    for (const et of sampleEventTypes) {
      const events = await prisma.horizonEvent.findMany({
        where: { eventType: et.eventType },
        include: { transaction: true, operation: true },
        orderBy: { timestamp: 'desc' },
        take: Math.min(3, limit),
      })

      console.log(`\n=== Samples for eventType=${et.eventType} ===`)
      const decodedType = decodeEventType(et.eventType)
      console.log('decoded eventType:', decodedType.decoded)

      const typeDump = {
        eventTypeRaw: et.eventType,
        eventTypeDecoded: decodedType.decoded,
        samples: [],
      }

      for (const e of events) {
        const decodedData = decodeEventData(e.eventData)
        const decodedEnvelope = decodeTxEnvelope(e.txEnvelope)

        // Get operations by tx hash: prefer DB, fallback to Horizon HTTP
        let ops = await prisma.horizonOperation.findMany({ where: { transactionHash: e.txHash } })
        if (!ops || ops.length === 0) {
          const httpOps = await fetchOperationsHttp(e.txHash)
          ops = httpOps.map(normalizeOperationRecord)
        }

        console.log('\n• event id:', e.eventId)
        console.log('core:', { ledger: e.ledger, contractId: e.contractId, txHash: e.txHash, timestamp: e.timestamp })
        console.log('raw eventData:', full ? e.eventData : summarizeObjectShape(e.eventData))
        console.log('decoded eventData:', full ? decodedData.decoded : summarizeObjectShape(decodedData.decoded))
        console.log('decoded txEnvelope:', full ? decodedEnvelope : summarizeObjectShape(decodedEnvelope))
        console.log('ops (by txHash):', full ? ops : summarizeObjectShape(ops))

        const txMin = e.transaction ? { hash: e.transaction.hash, successful: e.transaction.successful } : null
        const opMin = e.operation ? { id: e.operation.id, type: e.operation.operationType } : null

        typeDump.samples.push({
          eventId: e.eventId,
          ledger: e.ledger,
          contractId: e.contractId,
          txHash: e.txHash,
          timestamp: e.timestamp,
          rawEventData: e.eventData,
          decodedEventData: decodedData.decoded,
          decodedTxEnvelope: decodedEnvelope,
          opsByTxHash: ops,
          transaction: txMin,
          operation: opMin,
        })
      }

      dump.types.push(typeDump)
    }

    // Transactions
    const transactions = await prisma.horizonTransaction.findMany({
      orderBy: { timestamp: 'desc' },
      take: limit,
      include: { events: { take: 2, orderBy: { timestamp: 'desc' } } },
    })
    console.log('\nTransaction shape (latest):')
    if (transactions[0]) console.log(summarizeObjectShape(transactions[0]))
    console.log(`Transactions sampled: ${transactions.length}`)
    dump.transactionsSampleShape = transactions[0] ? summarizeObjectShape(transactions[0]) : null

    // Operations
    let opTypeCounts = []
    try {
      opTypeCounts = await prisma.horizonOperation.groupBy({ by: ['operationType'], _count: { operationType: true } })
    } catch (e) {
      const types = await prisma.horizonOperation.findMany({ select: { operationType: true }, distinct: ['operationType'], take: 100 })
      opTypeCounts = await Promise.all(
        types.map(async (t) => ({ operationType: t.operationType, _count: { operationType: await prisma.horizonOperation.count({ where: { operationType: t.operationType } }) } }))
      )
    }

    console.log('\nOperation types (by count):')
    opTypeCounts
      .sort((a, b) => b._count.operationType - a._count.operationType)
      .slice(0, 50)
      .forEach((ot) => { console.log(`- ${ot.operationType}: ${ot._count.operationType}`) })

    const operations = await prisma.horizonOperation.findMany({ orderBy: { ingestedAt: 'desc' }, take: limit, include: { events: { take: 2, orderBy: { timestamp: 'desc' } } } })
    console.log('\nOperation shape (latest):')
    if (operations[0]) console.log(summarizeObjectShape(operations[0]))
    console.log(`Operations sampled: ${operations.length}`)
    dump.operationsSampleShape = operations[0] ? summarizeObjectShape(operations[0]) : null

    console.log('\nHints: use --full to print entire raw/decoded payloads for eventData.')

    if (outFile) {
      await writeFile(outFile, JSON.stringify(dump, null, 2), 'utf-8')
      console.log(`\n✅ Wrote dump to ${outFile}`)
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
}) 