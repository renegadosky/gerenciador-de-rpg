import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollDice } from '../src/engine/dice.ts';

// gerador determinístico: devolve os valores em sequência (0..1)
const seq = (...vals: number[]) => { let i = 0; return () => vals[i++ % vals.length]; };
const vars: Record<string, number> = { força: 3, 'bônus de ataque': 2 };
const look = (n: string) => vars[n.toLowerCase()];
const names = ['Força', 'Bônus de Ataque'];

test('rolagem simples com bônus de variável', () => {
  // 0.99 em d6 → 6 ; 0 → 1
  const r = rollDice('2d6 + Força', names, look, seq(0.99, 0));
  assert.equal(r.ok, true);
  assert.equal(r.total, 10);
  assert.match(r.text, /\[6\+1\]/);
});
test('d20 sem quantidade, variável com espaços', () => {
  const r = rollDice('d20 + Bônus de Ataque', names, look, seq(0.5)); // 1+floor(10)=11
  assert.equal(r.total, 13);
});
test('manter maiores (4d6kh3) e menores', () => {
  const rng = seq(0, 0.2, 0.5, 0.99); // d6: 1,2,4,6
  assert.equal(rollDice('4d6kh3', names, look, rng).total, 12);
  assert.equal(rollDice('4d6kl1', names, look, seq(0, 0.2, 0.5, 0.99)).total, 1);
});
test('expressão com condição e funções', () => {
  const r = rollDice('max(1d6, 1d6) + 1', names, look, seq(0, 0.99));
  assert.equal(r.total, 7);
});
test('erros compreensíveis', () => {
  assert.equal(rollDice('', names, look).ok, false);
  assert.match(rollDice('Força + 2', names, look).error!, /Nenhum dado/);
  assert.match(rollDice('1d1', names, look).error!, /faces/);
  assert.match(rollDice('1000d6', names, look).error!, /dados/);
  assert.match(rollDice('1d6 + Magia', names, look).error!, /Magia/);
  assert.equal(rollDice('1d6 +', names, look).ok, false);
});
test('distribuição razoável com Math.random', () => {
  for (let i = 0; i < 200; i++) { const t = rollDice('1d20', [], look).total; assert.ok(t >= 1 && t <= 20); }
});
