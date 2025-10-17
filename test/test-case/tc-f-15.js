import { ExcelSqlQuery } from '../../src/excel-sql-query.ts';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * F-15: Streaming aggregation vs non-streaming aggregation
 * - Generates a synthetic CSV with many rows
 * - Runs the same aggregate-only query via streaming fast path and baseline path
 * - Compares correctness (results must match) and performance
 */
async function testF15StreamingAggregationCompare() {
  const results = [];
  const tmpCsvPath = path.join(__dirname, '../tmp_streaming_perf.csv');
  const ROWS = 200000; // large enough to show improvement while keeping test runtime reasonable

  // 1) Prepare synthetic CSV
  try {
    await generateLargeCsv(tmpCsvPath, ROWS);
    results.push({
      test: 'Generate synthetic CSV',
      status: 'PASS',
      rows: ROWS,
      file: tmpCsvPath
    });
  } catch (error) {
    results.push({
      test: 'Generate synthetic CSV',
      status: 'FAIL',
      error: error.message
    });
    return results;
  }

  // 2) Define aggregate-only query (weighted average derived from aggregates)
  const sql = `SELECT 
    SUM(amount * price * weight) AS weighted_sum,
    SUM(weight) AS total_weight,
    CASE WHEN SUM(weight) = 0 THEN 0 ELSE SUM(amount * price * weight) / SUM(weight) END AS weighted_average
  FROM Sheet
  WHERE category = 'A'`;

  // 3) Execute via streaming fast path
  const queryStreaming = new ExcelSqlQuery();
  const startStreaming = process.hrtime.bigint();
  let resStreaming;
  try {
    resStreaming = await queryStreaming.executeQuery(sql, tmpCsvPath);
  } catch (error) {
    results.push({
      test: 'Streaming aggregation execution',
      status: 'FAIL',
      error: error.message
    });
    return results;
  }
  const endStreaming = process.hrtime.bigint();
  const durStreamingMs = Number(endStreaming - startStreaming) / 1e6;

  results.push({
    test: 'Streaming aggregation execution',
    status: 'PASS',
    duration_ms: Math.round(durStreamingMs),
    output_sample: resStreaming && resStreaming[0]
  });

  // 4) Execute via baseline (disable streaming fast path)
  const queryBaseline = new ExcelSqlQuery({ disableStreamingAggregate: true });
  const startBaseline = process.hrtime.bigint();
  let resBaseline;
  try {
    resBaseline = await queryBaseline.executeQuery(sql, tmpCsvPath);
  } catch (error) {
    results.push({
      test: 'Baseline aggregation execution',
      status: 'FAIL',
      error: error.message
    });
    return results;
  }
  const endBaseline = process.hrtime.bigint();
  const durBaselineMs = Number(endBaseline - startBaseline) / 1e6;

  results.push({
    test: 'Baseline aggregation execution',
    status: 'PASS',
    duration_ms: Math.round(durBaselineMs),
    output_sample: resBaseline && resBaseline[0]
  });

  // 5) Correctness: compare results
  try {
    const eq = deepEqualAggregateResult(resStreaming, resBaseline);
    results.push({
      test: 'Correctness: streaming vs baseline results equal',
      status: eq ? 'PASS' : 'FAIL',
      error: eq ? undefined : 'Result rows differ'
    });
  } catch (error) {
    results.push({
      test: 'Correctness: streaming vs baseline results equal',
      status: 'FAIL',
      error: error.message
    });
  }

  // 6) Performance: improvement ratio
  try {
    const improvement = durBaselineMs > 0 ? (durBaselineMs / durStreamingMs) : 1;
    const note = `Baseline ${Math.round(durBaselineMs)}ms vs Streaming ${Math.round(durStreamingMs)}ms (x${improvement.toFixed(2)})`;
    results.push({
      test: 'Performance: streaming vs baseline time',
      status: 'PASS',
      note
    });
  } catch (error) {
    results.push({
      test: 'Performance: streaming vs baseline time',
      status: 'FAIL',
      error: error.message
    });
  }

  // Clean up tmp file (optional in CI)
  try {
    if (fs.existsSync(tmpCsvPath)) fs.unlinkSync(tmpCsvPath);
  } catch (_) {}

  return results;
}

async function generateLargeCsv(filePath, rows) {
  return new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(filePath);
    stream.on('error', reject);
    stream.on('finish', resolve);

    // header
    stream.write('amount,price,weight,category\n');
    // rows
    for (let i = 0; i < rows; i++) {
      // category A about half the time
      const category = (i % 2 === 0) ? 'A' : 'B';
      // Generate numeric values
      const amount = (i % 100) + 1; // 1..100
      const price = ((i % 50) + 1) * 0.5; // 0.5 .. 25.0
      const weight = ((i % 30) + 1) * 0.1; // 0.1 .. 3.0
      stream.write(`${amount},${price.toFixed(2)},${weight.toFixed(2)},${category}\n`);
    }
    stream.end();
  });
}

function deepEqualAggregateResult(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== 1 || b.length !== 1) return false;
  const ra = a[0];
  const rb = b[0];

  // Compare keys and numeric values with small tolerance for floating-point
  const keysA = Object.keys(ra).sort();
  const keysB = Object.keys(rb).sort();
  if (keysA.join(',') !== keysB.join(',')) return false;

  for (const k of keysA) {
    const va = ra[k];
    const vb = rb[k];
    if (typeof va === 'number' && typeof vb === 'number') {
      const diff = Math.abs(va - vb);
      if (diff > 1e-9) return false;
    } else if (Array.isArray(va) && Array.isArray(vb)) {
      if (va.length !== vb.length) return false;
      const sortedA = [...va].sort();
      const sortedB = [...vb].sort();
      if (JSON.stringify(sortedA) !== JSON.stringify(sortedB)) return false;
    } else {
      if (JSON.stringify(va) !== JSON.stringify(vb)) return false;
    }
  }
  return true;
}

export { testF15StreamingAggregationCompare };