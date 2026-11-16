import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renameInFormula, nameProblem, formatIdent } from '../src/engine/formula/index.ts';
import { computeVariables } from '../src/editor/compute.ts';
import { interpolate, formatNumber } from '../src/lib/format.ts';
import { fitRect, zoomAt, niceStep, toWorld } from '../src/editor/viewport.ts';
import type { Variable } from '../src/types/index.ts';

const V = (id: string, name: string, initial: any, formula = '', type: Variable['type'] = 'number'): Variable =>
  ({ id, name, type, initial, formula, group: '', description: '' });

test('renomear variável reescreve só referências', () => {
  assert.equal(renameInFormula('Força + (Agilidade / 2)', 'Força', 'Poder'), 'Poder + (Agilidade / 2)');
  assert.equal(renameInFormula('[Pontos de Vida] * 2 + força', 'Pontos de Vida', 'PV'), 'PV * 2 + força');
  assert.equal(renameInFormula('Força + 1', 'Força', 'Pontos de Força'), '[Pontos de Força] + 1');
  assert.equal(renameInFormula('max(Força, 3)', 'max', 'x'), 'max(Força, 3)'); // função intacta
  assert.equal(renameInFormula('se(A == "A", 1, 2)', 'A', 'B'), 'se(B == "A", 1, 2)'); // texto intacto
  assert.equal(renameInFormula('1 +', 'A', 'B'), '1 +'); // fórmula inválida não quebra
  assert.equal(formatIdent('e'), '[e]');
});
test('validação de nome', () => {
  assert.ok(nameProblem('', []));
  assert.ok(nameProblem('Força', ['força']));
  assert.ok(nameProblem('a]b', []));
  assert.equal(nameProblem('Força', ['Agilidade']), null);
});

test('computeVariables usa overrides de jogo só nas variáveis sem fórmula', () => {
  const vars = [V('1', 'Força', 10), V('2', 'Agilidade', 4), V('3', 'Defesa', 0, 'Força + (Agilidade / 2)'), V('4', 'Ruim', 0, '1/0')];
  const base = computeVariables(vars);
  assert.equal(base.byId['3'], 12);
  const play = computeVariables(vars, { '1': 14, '3': 999 });
  assert.equal(play.byId['3'], 16); // 999 ignorado: tem fórmula
  assert.ok(play.errorById['4']);
  assert.equal(play.byId['4'], undefined);
  assert.ok(play.isFormula.has('3'));
  assert.equal(play.byName.get('força'), 14);
});
test('tipos: texto "7" vira número em variável numérica', () => {
  assert.equal(computeVariables([V('1', 'X', '7')]).byId['1'], 7);
  assert.equal(computeVariables([V('1', 'B', 'true', '', 'boolean')]).byId['1'], true);
});

test('interpolação', () => {
  const m = new Map<string, any>([['força', 14], ['classe', 'Mago']]);
  const look = (n: string) => m.get(n.toLowerCase());
  assert.equal(interpolate('FOR {Força} — {Classe} {Nada}', look), 'FOR 14 — Mago {Nada}');
  assert.equal(formatNumber(3.456), '3,46');
  assert.equal(formatNumber(2, 0), '2');
});

test('viewport: zoom mantém o ponto sob o cursor; fit centraliza', () => {
  const vp = { zoom: 1, x: 100, y: 50 };
  const w0 = toWorld(vp, 300, 200);
  const z = zoomAt(vp, 2, 300, 200);
  const w1 = toWorld(z, 300, 200);
  assert.ok(Math.abs(w0.x - w1.x) < 1e-9 && Math.abs(w0.y - w1.y) < 1e-9);
  const f = fitRect({ x: 0, y: 0, w: 1000, h: 500 }, 1128, 628, 64);
  assert.equal(f.zoom, 1);
  assert.equal(f.x, 64);
  assert.equal(niceStep(1), 100);
  assert.equal(niceStep(4), 20);
});

import { nodeFormulaVars, nodeVarId } from '../src/editor/compute.ts';
import { createNode } from '../src/editor/defaults.ts';

test('campo com fórmula própria entra no cálculo sem variável cadastrada', () => {
  const n = createNode('number', { x: 0, y: 0 });
  n.data.formula = '10 + Nova variável 2 * 2';
  const vars = [V('1', 'Nova variável 2', 5)];
  const c = computeVariables([...vars, ...nodeFormulaVars([n])]);
  assert.equal(c.byId[nodeVarId(n.id)], 20); // nome com espaço sem colchetes
  const bound = createNode('number', { x: 0, y: 0 });
  bound.data.formula = '1 + 1'; bound.data.bind = '1';
  assert.equal(nodeFormulaVars([bound]).length, 0); // vinculado a variável: ignora fórmula do campo
  const bad = createNode('number', { x: 0, y: 0 }); bad.data.formula = '1 +';
  assert.ok(computeVariables(nodeFormulaVars([bad])).errorById[nodeVarId(bad.id)]);
});

import { seedLibraryTypes } from '../src/lib/librarySeed.ts';
import { backlinks } from '../src/lib/libraryLinks.ts';

test('categorias iniciais: todas com ids próprios e campos independentes', () => {
  const ts = seedLibraryTypes('p');
  assert.equal(ts.length, 17);
  assert.equal(new Set(ts.map((t) => t.id)).size, 17);
  const ids = ts.flatMap((t) => t.fields.map((f) => f.id));
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ts.find((t) => t.name === 'Armas')!.fields.some((f) => f.name === 'Dano'));
});
test('backlinks encontram quem aponta para o registro', () => {
  const types = [{ id: 't', projectId: 'p', name: 'T', icon: 'book', position: 0, fields: [{ id: 'f', name: 'Org', kind: 'link' as const }] }];
  const recs = [
    { id: 'a', projectId: 'p', typeId: 't', name: 'A', data: { f: ['b'] }, updatedAt: '' },
    { id: 'b', projectId: 'p', typeId: 't', name: 'B', data: {}, updatedAt: '' },
  ];
  assert.deepEqual(backlinks(recs, types, 'b').map((x) => x.record.id), ['a']);
  assert.equal(backlinks(recs, types, 'a').length, 0);
});
