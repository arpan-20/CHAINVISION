export interface FefoBatch {
  id: string
  skuId: string
  dcId: string
  batchNo: string
  quantity: number
  expiryDate: string
  receivedDate: string
}

export interface FefoSequencedBatch extends FefoBatch {
  allocationRank: number
}

export interface FefoAllocation {
  batchId: string
  skuId: string
  dcId: string
  batchNo: string
  expiryDate: string
  allocationRank: number
  availableQuantity: number
  allocatedQuantity: number
}

const parseIsoDateAtUtcMidnight = (value: string): Date => {
  const parsed = new Date(`${value}T00:00:00.000Z`)

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ISO date: ${value}`)
  }

  return parsed
}

const validateQuantity = (quantity: number): void => {
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new Error('Batch quantity values must be finite, non-negative numbers')
  }
}

export const sequenceFefo = (batches: FefoBatch[]): FefoSequencedBatch[] =>
  [...batches]
    .map((batch) => {
      validateQuantity(batch.quantity)
      parseIsoDateAtUtcMidnight(batch.expiryDate)
      parseIsoDateAtUtcMidnight(batch.receivedDate)

      return batch
    })
    .sort((left, right) => {
      const expiryDelta =
        parseIsoDateAtUtcMidnight(left.expiryDate).getTime() -
        parseIsoDateAtUtcMidnight(right.expiryDate).getTime()

      if (expiryDelta !== 0) {
        return expiryDelta
      }

      return left.batchNo.localeCompare(right.batchNo)
    })
    .map((batch, index) => ({
      ...batch,
      allocationRank: index + 1,
    }))

export const planFefoAllocation = (
  batches: FefoBatch[],
  requestedQuantity: number,
): FefoAllocation[] => {
  if (!Number.isFinite(requestedQuantity) || requestedQuantity < 0) {
    throw new Error('requestedQuantity must be a finite, non-negative number')
  }

  let remainingQuantity = requestedQuantity

  return sequenceFefo(batches)
    .map((batch) => {
      const allocatedQuantity = Math.min(batch.quantity, remainingQuantity)
      remainingQuantity -= allocatedQuantity

      return {
        batchId: batch.id,
        skuId: batch.skuId,
        dcId: batch.dcId,
        batchNo: batch.batchNo,
        expiryDate: batch.expiryDate,
        allocationRank: batch.allocationRank,
        availableQuantity: batch.quantity,
        allocatedQuantity,
      }
    })
    .filter((allocation) => allocation.allocatedQuantity > 0)
}
