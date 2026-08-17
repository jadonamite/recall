/**
 * Batched writes that survive the driver's packing fault.
 *
 * The Bolt driver intermittently throws while packing a batch:
 *
 *   RangeError: The value of "offset" is out of range. It must be >= 0 and <= 4.
 *   Received 5
 *
 * The bound moves between runs (4, 8, …) and always sits exactly one byte below
 * what is being written, which points at the chunk writer running out of room
 * rather than at anything wrong with the rows. It depends on the serialised byte
 * size of the batch, not on row count and not on whether the rows carry strings
 * — integer-only edge batches hit it too.
 *
 * Guessing a batch size that never trips it does not work; the threshold moves.
 * So instead: try, and on failure halve and retry, down to a single row. A batch
 * that fails at 100 rows almost always succeeds as two batches of 50. Only a
 * genuine server rejection survives all the way down to one row, and that is
 * the error worth reporting.
 */

'use strict';

/** Errors that are worth splitting a batch for, rather than reporting. */
const isPackingFault = (e) =>
  e instanceof RangeError ||
  e?.code === 'ERR_OUT_OF_RANGE' ||
  /offset.*out of range/i.test(e?.message ?? '');

/**
 * Run `cypher` over `rows` in batches, splitting on packing faults.
 *
 * @param {import('neo4j-driver').Session} session
 * @param {string} label            what this write is, for error messages
 * @param {object[]} rows
 * @param {string} cypher           must UNWIND $rows
 * @param {{size?: number, onProgress?: (done: number, total: number) => void}} [opts]
 */
export async function batchedRun(session, label, rows, cypher, opts = {}) {
  const { size = 100, onProgress } = opts;
  let done = 0;
  let splits = 0;

  const run = async (slice, width) => {
    try {
      await session.run(cypher, { rows: slice });
      done += slice.length;
      onProgress?.(done, rows.length);
      return;
    } catch (e) {
      if (!isPackingFault(e) || slice.length === 1) {
        throw new Error(`${label}: batch of ${slice.length} at row ${done} of ${rows.length} — ${e.message}`);
      }
    }
    // Packing fault on more than one row: halve and retry.
    splits++;
    const mid = Math.ceil(slice.length / 2);
    await run(slice.slice(0, mid), mid);
    await run(slice.slice(mid), slice.length - mid);
  };

  for (let i = 0; i < rows.length; i += size) {
    await run(rows.slice(i, i + size), size);
  }
  return { splits };
}
