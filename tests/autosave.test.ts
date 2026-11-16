import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Autosaver } from '../src/lib/autosave.ts';
import { ConflictError } from '../src/data/repository.ts';
import { createLocalRepository } from '../src/data/localRepository.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('agrupa várias alterações em uma gravação', async () => {
  let saves = 0; const st: string[] = [];
  const a = new Autosaver({ delay: 20, save: async () => { saves++; }, onStatus: (s) => st.push(s) });
  a.touch(); a.touch(); a.touch();
  await sleep(80);
  assert.equal(saves, 1);
  assert.equal(st.at(-1), 'saved');
});

test('alteração durante a gravação gera nova gravação (sem sobreposição)', async () => {
  let saves = 0, concurrent = 0, maxC = 0;
  const a = new Autosaver({
    delay: 10,
    save: async () => { saves++; concurrent++; maxC = Math.max(maxC, concurrent); await sleep(40); concurrent--; },
    onStatus: () => {},
  });
  a.touch();
  await sleep(25);   // gravando
  a.touch();
  await sleep(200);
  assert.equal(saves, 2);
  assert.equal(maxC, 1);
});

test('repete após erro transitório e conflito não é repetido', async () => {
  let n = 0; const st: string[] = [];
  const a = new Autosaver({ delay: 5, retryDelay: 10, save: async () => { if (++n < 3) throw new Error('rede'); }, onStatus: (s) => st.push(s) });
  a.touch(); await sleep(150);
  assert.equal(n, 3); assert.equal(st.at(-1), 'saved'); assert.ok(st.includes('error'));

  let m = 0; const st2: string[] = [];
  const b = new Autosaver({ delay: 5, save: async () => { m++; throw new ConflictError(); }, onStatus: (s) => st2.push(s) });
  b.touch(); await sleep(60);
  assert.equal(m, 1); assert.equal(st2.at(-1), 'conflict');
});

test('flush grava imediatamente', async () => {
  let saves = 0;
  const a = new Autosaver({ delay: 10_000, save: async () => { saves++; }, onStatus: () => {} });
  a.touch(); await a.flush();
  assert.equal(saves, 1);
});

test('repositório local: CRUD, versão e conflito', async () => {
  const repo = createLocalRepository('teste');
  const p = await repo.createProject({ name: 'Meu sistema', description: '', coverUrl: null });
  assert.equal((await repo.listProjects()).length, 1);
  const s = await repo.createSheet(p.id, 'Ficha 1');
  assert.equal(s.version, 1);
  const s2 = await repo.saveSheet({ ...s, name: 'Ficha A' });
  assert.equal(s2.version, 2);
  await assert.rejects(repo.saveSheet({ ...s, name: 'velha' }), ConflictError); // versão obsoleta
  assert.equal((await repo.listSheets(p.id))[0].name, 'Ficha A');

  await repo.saveVariables(p.id, [{ id: 'v1', name: 'Força', type: 'number', initial: 10, formula: '', group: '', description: '' }]);
  assert.equal((await repo.listVariables(p.id))[0].name, 'Força');

  // isolamento entre projetos
  const q = await repo.createProject({ name: 'Outro', description: '', coverUrl: null });
  assert.equal((await repo.listVariables(q.id)).length, 0);
  assert.equal((await repo.listSheets(q.id)).length, 0);

  await repo.deleteProject(p.id);
  assert.equal((await repo.listProjects()).length, 1);
  await assert.rejects(repo.getSheet(s.id));
});

test('modelo → personagem → exportar/importar (ciclo mestre ↔ jogador)', async () => {
  const { parseTemplateBundle, parseCharacterBundle, BundleError } = await import('../src/data/repository.ts');
  const gm = createLocalRepository('mestre');
  const p = await gm.createProject({ name: 'Magia', description: 'd', coverUrl: null });
  await gm.saveVariables(p.id, [{ id: 'v1', name: 'Força', type: 'number', initial: 3, formula: '', group: '', description: '' }]);
  const s = await gm.createSheet(p.id, 'Ficha de Mago');
  const bundle = JSON.parse(JSON.stringify(await gm.exportTemplate(p.id, s.id)));

  // jogador (outra conta/navegador) importa o modelo
  const pl = createLocalRepository('jogador');
  const imported = await pl.importTemplate(parseTemplateBundle(bundle));
  assert.equal(imported.kind, 'imported');
  assert.equal((await pl.listVariables(imported.id))[0].id, 'v1'); // ids preservados
  const ch = await pl.createCharacter(imported.id, s.id, 'Diego');
  const saved = await pl.saveCharacter({ ...ch, play: { vars: { v1: 9 }, nodes: { n1: 'texto' } } });
  assert.equal(saved.version, 2);
  await assert.rejects(pl.saveCharacter({ ...ch }), ConflictError);

  // jogador devolve o personagem ao mestre
  const cb = JSON.parse(JSON.stringify(await pl.exportCharacter(ch.id)));
  const back = await gm.importCharacter(parseCharacterBundle(cb));
  assert.equal(back.name, 'Diego');
  assert.equal(back.play.vars.v1, 9);
  assert.equal((await gm.listCharacters(p.id)).length, 1);

  // reimportar atualização do modelo não apaga personagens do jogador
  const again = await pl.importTemplate(parseTemplateBundle(bundle));
  assert.equal(again.id, imported.id);
  assert.equal((await pl.listCharacters(imported.id)).length, 1);

  // o autor não pode "importar" o próprio modelo; arquivos inválidos são recusados
  await assert.rejects(gm.importTemplate(parseTemplateBundle(bundle)), BundleError);
  assert.throws(() => parseTemplateBundle({ format: 'x' }), BundleError);
  assert.throws(() => parseCharacterBundle(null), BundleError);
  // personagem sem o modelo correspondente
  await assert.rejects(createLocalRepository('outro').importCharacter(parseCharacterBundle(cb)), BundleError);
});

test('biblioteca (local): tipos, registros e cascata ao apagar tipo', async () => {
  const repo = createLocalRepository('lib');
  const p = await repo.createProject({ name: 'Lib', description: '', coverUrl: null });
  await repo.saveLibraryTypes(p.id, [
    { id: 't1', projectId: p.id, name: 'Armas', icon: 'sword', position: 0, fields: [{ id: 'f1', name: 'Dano', kind: 'text' }] },
    { id: 't2', projectId: p.id, name: 'Cidades', icon: 'map', position: 1, fields: [] },
  ]);
  await repo.saveLibraryRecord({ id: 'r1', projectId: p.id, typeId: 't1', name: 'Espada', data: { f1: '1d8' }, updatedAt: '' });
  await repo.saveLibraryRecord({ id: 'r2', projectId: p.id, typeId: 't2', name: 'Vila', data: {}, updatedAt: '' });
  await repo.saveLibraryRecord({ id: 'r1', projectId: p.id, typeId: 't1', name: 'Espada longa', data: { f1: '1d10' }, updatedAt: '' }); // atualiza
  const recs = await repo.listLibraryRecords(p.id);
  assert.equal(recs.length, 2);
  assert.equal(recs.find((r) => r.id === 'r1')!.name, 'Espada longa');
  await repo.deleteLibraryRecord('r2');
  assert.equal((await repo.listLibraryRecords(p.id)).length, 1);
  // apagar o tipo apaga seus registros
  await repo.saveLibraryTypes(p.id, [{ id: 't2', projectId: p.id, name: 'Cidades', icon: 'map', position: 0, fields: [] }]);
  assert.equal((await repo.listLibraryRecords(p.id)).length, 0);
  assert.equal((await repo.listLibraryTypes(p.id)).length, 1);
  // isolamento e remoção do projeto
  const q = await repo.createProject({ name: 'Outro', description: '', coverUrl: null });
  assert.equal((await repo.listLibraryTypes(q.id)).length, 0);
  await repo.deleteProject(p.id);
  assert.equal((await repo.listLibraryTypes(p.id)).length, 0);
});
