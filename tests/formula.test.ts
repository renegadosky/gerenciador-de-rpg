import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, computeAll, evalFormula, FormulaError, parse } from '../src/engine/formula/index.ts';

test('aritmética e precedência', () => {
  assert.equal(evalFormula('2 + 3 * 4'), 14);
  assert.equal(evalFormula('(2 + 3) * 4'), 20);
  assert.equal(evalFormula('2 ^ 3 ^ 2'), 512); // associativa à direita
  assert.equal(evalFormula('-2 ^ 2'), -4); // unário tem precedência menor que ^
  assert.equal(evalFormula('10 % 3'), 1);
  assert.equal(evalFormula('7 / 2'), 3.5);
  assert.equal(evalFormula('1.5 + .5'), 2);
});

test('comparações e lógica', () => {
  assert.equal(evalFormula('3 > 2'), true);
  assert.equal(evalFormula('3 <= 2'), false);
  assert.equal(evalFormula('2 == 2 && 1 != 2'), true);
  assert.equal(evalFormula('falso ou verdadeiro'), true);
  assert.equal(evalFormula('nao falso'), true);
  assert.equal(evalFormula('"a" == "a"'), true);
});

test('condição se()', () => {
  assert.equal(evalFormula('se(Força >= 10, 5, 0)', { Força: 12 }), 5);
  assert.equal(evalFormula('se(Força >= 10, 5, 0)', { Força: 3 }), 0);
  // ramo não escolhido não é avaliado (não dá divisão por zero)
  assert.equal(evalFormula('se(1 > 0, 1, 1 / 0)'), 1);
});

test('funções', () => {
  assert.equal(evalFormula('max(1, 9, 4)'), 9);
  assert.equal(evalFormula('min(1, 9, 4)'), 1);
  assert.equal(evalFormula('piso(7 / 2)'), 3);
  assert.equal(evalFormula('teto(7 / 2)'), 4);
  assert.equal(evalFormula('arredondar(3.14159, 2)'), 3.14);
  assert.equal(evalFormula('limitar(15, 0, 10)'), 10);
  assert.equal(evalFormula('media(2, 4, 6)'), 4);
});

test('exemplo do briefing: Defesa = Força + (Agilidade / 2), com recálculo', () => {
  const mk = (forca: number, agi: number) => computeAll([
    { name: 'Força', value: forca },
    { name: 'Agilidade', value: agi },
    { name: 'Defesa', value: 0, formula: 'Força + (Agilidade / 2)' },
  ]);
  assert.equal(mk(10, 4).values['Defesa'], 12);
  assert.equal(mk(14, 4).values['Defesa'], 16);
  assert.equal(mk(14, 10).values['Defesa'], 19);
});

test('dependências encadeadas independem da ordem de declaração', () => {
  const r = computeAll([
    { name: 'C', value: 0, formula: 'B * 2' },
    { name: 'B', value: 0, formula: 'A + 1' },
    { name: 'A', value: 5 },
  ]);
  assert.equal(r.values['C'], 12);
  assert.ok(r.order.indexOf('A') < r.order.indexOf('B') && r.order.indexOf('B') < r.order.indexOf('C'));
});

test('nomes insensíveis a maiúsculas e com colchetes', () => {
  const r = computeAll([
    { name: 'Pontos de Vida', value: 20 },
    { name: 'Metade', value: 0, formula: '[pontos de vida] / 2' },
    { name: 'FORÇA', value: 3 },
    { name: 'X', value: 0, formula: 'força + 1' },
  ]);
  assert.equal(r.values['Metade'], 10);
  assert.equal(r.values['X'], 4);
});

test('ciclos são detectados com o caminho', () => {
  const r = computeAll([
    { name: 'A', value: 0, formula: 'B + 1' },
    { name: 'B', value: 0, formula: 'C + 1' },
    { name: 'C', value: 0, formula: 'A + 1' },
    { name: 'Ok', value: 1 },
  ]);
  assert.equal(r.errors['A'].code, 'CYCLE');
  assert.match(r.errors['A'].message, /A → B → C → A/);
  assert.equal(r.errors['B'].code, 'CYCLE');
  assert.equal(r.values['Ok'], 1);
});

test('auto-referência é ciclo', () => {
  const r = computeAll([{ name: 'A', value: 0, formula: 'A + 1' }]);
  assert.equal(r.errors['A'].code, 'CYCLE');
});

test('erro em uma variável não derruba as outras e propaga como DEPENDENCY', () => {
  const r = computeAll([
    { name: 'Ruim', value: 0, formula: '1 / 0' },
    { name: 'Neto', value: 0, formula: 'Ruim + 1' },
    { name: 'Bom', value: 2, formula: '1 + 1' },
  ]);
  assert.equal(r.errors['Ruim'].code, 'DIV_ZERO');
  assert.equal(r.errors['Neto'].code, 'DEPENDENCY');
  assert.equal(r.values['Bom'], 2);
});

test('mensagens de erro compreensíveis com posição', () => {
  const a = analyze('Forca + 1', ['Força', 'Agilidade']);
  assert.equal(a.ok, false);
  assert.equal(a.errors[0].code, 'UNKNOWN_VARIABLE');
  assert.match(a.errors[0].message, /Você quis dizer "Força"/);
  assert.equal(a.errors[0].pos, 0);

  const b = analyze('maxx(1,2)', []);
  assert.equal(b.errors[0].code, 'UNKNOWN_FUNCTION');
  assert.match(b.errors[0].message, /max/);

  const c = analyze('(1 + 2', []);
  assert.equal(c.errors[0].code, 'SYNTAX');
  assert.match(c.errors[0].message, /parêntese/);

  const d = analyze('1 +', []);
  assert.equal(d.errors[0].code, 'SYNTAX');

  const e = analyze('1 2', []);
  assert.match(e.errors[0].message, /operador/);

  const f = analyze('se(1, 2)', []);
  assert.equal(f.errors[0].code, 'ARITY');

  assert.equal(analyze('', []).ok, false);
  assert.equal(analyze('Força * 2', ['Força']).ok, true);
});

test('tipos: texto não numérico em conta gera erro claro', () => {
  const r = computeAll([
    { name: 'Classe', value: 'Mago' },
    { name: 'X', value: 0, formula: 'Classe + 1' },
    { name: 'Y', value: 0, formula: 'se(Classe == "Mago", 3, 0)' },
  ]);
  assert.equal(r.errors['X'].code, 'TYPE');
  assert.equal(r.values['Y'], 3);
});

test('segurança: nada de execução de código', () => {
  for (const evil of ['constructor.constructor("return 1")()', 'process.exit()', 'globalThis', '__proto__', 'this']) {
    const a = analyze(evil, []);
    assert.equal(a.ok, false, evil);
  }
  assert.throws(() => parse('alert(1);'), FormulaError);
});

test('nomes com espaços e dígitos funcionam sem colchetes', () => {
  const r = computeAll([
    { name: 'Nova variável', value: 5 },
    { name: 'Nova variável 2', value: 7 },
    { name: 'Pontos de Vida', value: 20 },
    { name: 'Soma', value: 0, formula: 'Nova variável 2 + Nova variável * 2' },
    { name: 'Metade', value: 0, formula: 'Pontos de Vida / 2' },
    { name: 'Cond', value: 0, formula: 'se(Pontos de Vida > 10, Nova variável, 0)' },
  ]);
  assert.equal(r.errors['Soma'], undefined);
  assert.equal(r.values['Soma'], 17); // "Nova variável 2" não é "Nova variável" seguido de 2
  assert.equal(r.values['Metade'], 10);
  assert.equal(r.values['Cond'], 5);
  assert.equal(analyze('Pontos de Vida + 1', ['Pontos de Vida']).ok, true);
});

test('vírgula decimal fora de funções; dentro delas separa argumentos', () => {
  assert.equal(evalFormula('2,5 * 2'), 5);
  assert.equal(evalFormula('max(2,5)'), 5);
  assert.equal(evalFormula('max(2,5; 3)'.replace(';', ',')), 5);
  assert.equal(evalFormula('(1,5 + 1,5) * 2'), 6);
});

test('renomear com nomes que têm espaços', async () => {
  const { renameInFormula } = await import('../src/engine/formula/index.ts');
  assert.equal(renameInFormula('Pontos de Vida / 2 + Força', 'Pontos de Vida', 'PV', ['Força']), 'PV / 2 + Força');
});
