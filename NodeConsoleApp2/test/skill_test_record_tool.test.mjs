import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(import.meta.dirname, '..');

test('剑系流血输出循环工具按时间戳生成 Skill 测试记录三件套', async () => {
  const outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-test-record-'));
  const timestamp = '2026-05-30-123456';
  const recordDir = path.join(outputRoot, `${timestamp}-剑系流血输出循环自测`);

  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      ['tools/generate_sword_bleed_loop_report.mjs'],
      {
        cwd: projectRoot,
        env: {
          ...process.env,
          SKILL_TEST_RECORD_OUTPUT_ROOT: outputRoot,
          SKILL_TEST_RECORD_TIMESTAMP: timestamp
        },
        maxBuffer: 1024 * 1024 * 8
      }
    );

    assert.match(stdout, /report\.html/);
    await fs.access(path.join(recordDir, 'report.html'));
    await fs.access(path.join(recordDir, 'report.json'));
    await fs.access(path.join(recordDir, 'findings.md'));

    const report = JSON.parse(await fs.readFile(path.join(recordDir, 'report.json'), 'utf8'));
    assert.equal(report.meta.timestamp, timestamp);
    assert.equal(report.meta.artifactKind, 'skill_test_record');
    assert.equal(report.results.length, 3);
    assert.ok(report.findings.some(item => item.id === 'ap_underuse_fixed_combo'));
  } finally {
    await fs.rm(outputRoot, { recursive: true, force: true });
  }
});
