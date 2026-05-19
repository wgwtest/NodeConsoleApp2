import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');

async function readProjectFile(relativePath) {
  return fs.readFile(path.join(projectRoot, relativePath), 'utf8');
}

test('WBS-3.3.3.1 的计划与索引已回写为自动点击验收通过状态', async () => {
  const [nodePlan, c3Plan, indexPlan] = await Promise.all([
    readProjectFile('DOC/CODEX_DOC/03_研制计划/18-WBS-3.3.3.1-技能旧标签退役与字段级契约迁移.md'),
    readProjectFile('DOC/CODEX_DOC/03_研制计划/11-WBS-L2-C3-技能运行时一致性与说明校核.md'),
    readProjectFile('DOC/CODEX_DOC/03_研制计划/README.md')
  ]);

  assert.match(nodePlan, /当前状态：\s*`已实现 \/ 已自测 \/ 已通过（自动点击验收）`/u);
  assert.match(c3Plan, /#99[\s\S]*已实现\s*\/\s*已自测\s*\/\s*已通过（自动点击验收）/u);
  assert.match(indexPlan, /#99\s*\/\s*WBS-3\.3\.3\.1[\s\S]*已通过（自动点击验收）/u);
});

test('当前待验收总入口已移除自动点击验收通过节点', async () => {
  const entry = await readProjectFile('DOC/CODEX_DOC/05_测试文档/02_验收清单/00-当前待验收功能总入口.md');

  assert.match(entry, /当前无直接待验收节点/u);
  assert.match(entry, /11\s*个节点已根据自动点击验收结果转入已通过/u);

  for (const passedNode of [
    'WBS-3.3.3.1',
    'WBS-3.2.2.1',
    'WBS-3.2.2.2',
    'WBS-3.2.2.3',
    'WBS-4.2.1',
    'WBS-4.2.2',
    'WBS-4.2.3'
  ]) {
    const escaped = passedNode.replaceAll('.', '\\.');
    const pattern = new RegExp(`当前直接待验收节点[\\s\\S]*${escaped}(?!\\.)`, 'u');
    assert.equal(pattern.test(entry), false, `待验收总入口不应回流已通过节点 ${passedNode}`);
  }

  assert.match(entry, /WBS-4\.3\.2\.1/u);
  assert.match(entry, /WBS-4\.3\.5/u);
});

test('测试文档总 README 已建立正式入口分层说明', async () => {
  const testingReadme = await readProjectFile('DOC/CODEX_DOC/05_测试文档/README.md');

  assert.match(testingReadme, /mock_ui_v11\.html/u);
  assert.match(testingReadme, /test\/codex_regression_runner\.html/u);
  assert.match(testingReadme, /00-当前待验收功能总入口\.md/u);
  assert.match(testingReadme, /正式主流程入口/u);
  assert.match(testingReadme, /共享回归入口/u);
  assert.match(testingReadme, /人工验收入口/u);
});

test('运行与交付说明已经固定到 README 与 CHANGELOG', async () => {
  const [repoReadme, changelog] = await Promise.all([
    fs.readFile(path.resolve(projectRoot, '..', 'README.md'), 'utf8'),
    readProjectFile('CHANGELOG.md')
  ]);

  assert.match(repoReadme, /PORT=3101 node app\.js/u);
  assert.match(repoReadme, /mock_ui_v11\.html/u);
  assert.match(repoReadme, /codex_regression_runner\.html/u);
  assert.match(changelog, /当前版本定位/u);
  assert.match(changelog, /已知问题/u);
  assert.match(changelog, /交付目录/u);
});
