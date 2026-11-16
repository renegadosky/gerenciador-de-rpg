# Gerenciador de RPG

Plataforma para autores criarem o **próprio** sistema de RPG: ficha desenhada livremente (estilo Figma), regras e fórmulas próprias, biblioteca de conteúdo e documentação do universo. **Nenhuma ficha, atributo ou categoria vem pronta.**

> **Estado:** etapas 1–7 (inclui **Biblioteca**) + fluxo **mestre → jogadores** (modelos, personagens, importar/exportar), rolagem de dados e 5 temas visuais. Relações e documentação (etapas 8–9) ainda sem interface (tabelas já no SQL).
>
> A lógica pura (fórmulas, dados, cena, autosave, repositório, importação) tem testes automatizados (`npm test`). A interface foi verificada pelo uso real do autor do projeto, mas `npm run typecheck` ainda deve ser rodado a cada mudança.

## Fluxo mestre → jogadores

1. **Mestre:** em *Regras*, cria as variáveis; em *Modelos de ficha*, desenha o layout e vincula os campos. Botão **Testar** mostra como o jogador verá.
2. **Mestre:** em *Modelos de ficha*, clica em **Enviar aos jogadores** → baixa um arquivo `.rpg.json` (layout + regras) e manda por Discord/WhatsApp/e-mail.
3. **Jogador:** abre o site → **Importar modelo do mestre** → *Novo personagem*. Só preenche: nome, atributos, imagem do personagem (nos campos que o mestre liberou), listas, tabelas, rolagens. **Não consegue alterar o layout.**
4. **Jogador → mestre:** no personagem, **Exportar** baixa um arquivo; o mestre o importa em *Personagens* e vê a ficha preenchida.
5. **Mudou o modelo?** O mestre envia o arquivo de novo; ao importar, os personagens existentes continuam valendo (os ids são mantidos).

> Importar/exportar por arquivo funciona no **modo local**. Com Supabase configurado ainda não há importação (o compartilhamento por convite/link é o próximo passo natural para esse modo).

## Rodando

```bash
npm install
npm test            # testes do motor de fórmulas, cena, autosave e repositório
npm run typecheck   # checagem de tipos (corrija o que aparecer antes do primeiro deploy)
npm run dev         # http://localhost:5173
```

Sem configurar nada, o app roda em **modo local**: sem login, dados no IndexedDB do navegador.

### Com Supabase (login + banco na nuvem)

1. Crie um projeto em supabase.com.
2. No *SQL Editor*, rode `supabase/migrations/0001_init.sql`.
3. Copie `.env.example` para `.env` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
4. `npm run dev`. A tela de login aparece; cada usuário só enxerga seus projetos (RLS).

### Publicar no GitHub

```bash
git init && git add . && git commit -m "Gerenciador de RPG: etapas 1–6"
git branch -M main
git remote add origin git@github.com:SEU_USUARIO/gerenciador-rpg.git
git push -u origin main
```
O workflow `.github/workflows/ci.yml` roda testes, typecheck e build a cada push. O app usa `HashRouter` e `base: './'`, então funciona em GitHub Pages sem configuração extra (modo local).

## O que já funciona

**Projetos** — criar, editar (nome, descrição, capa), excluir; dados isolados por projeto.

**Editor visual** (DOM/CSS, não canvas — ver decisões):
- Elementos: texto, imagem, caixa, formas (retângulo, elipse, triângulo, losango, linha), tabela, campo numérico, campo de texto, seleção, barra de progresso, indicador, botão, ícone, lista.
- Mover, redimensionar (8 puxadores, com Shift mantém proporção, Alt a partir do centro), girar (Shift = 15°), sobrepor, camadas (ordem, arrastar na lista, travar, ocultar, renomear), agrupar/desagrupar, duplicar (Ctrl+D ou Alt+arrastar), copiar/colar/recortar (inclusive grupos), excluir, alinhar, distribuir (igual ou com espaço fixo), coordenadas numéricas, desfazer/refazer (100 passos).
- Área de trabalho: zoom (Ctrl+roda/pinça), pan (Espaço+arrastar, botão do meio, roda), grade opcional, encaixe com guias magnéticas (Ctrl desativa), réguas, seleção múltipla (retângulo e Shift), arrastar/colar imagens.
- Painel de propriedades por tipo (imagem, texto, campos, barra, indicador, botão, ícone, lista, tabela) e da página.

**Regras** — variáveis do usuário (número/texto/booleano), grupos livres, valor inicial, fórmula. Renomear atualiza as fórmulas que a usam.

**Fórmulas** — `Defesa = Força + (Agilidade / 2)` recalcula sozinha. Operadores `+ - * / % ^`, comparações, `e`/`ou`/`nao`, `se(cond, a, b)`, `min max soma media piso teto arredondar limitar raiz abs potencia`. Nomes com espaço: `[Pontos de Vida]`. Interpretador próprio (tokenizer → parser Pratt → AST → avaliador), **sem `eval`/`Function`**. Erros em português com trecho destacado e sugestão ("Você quis dizer *Força*?"), detecção de ciclos (`A → B → C → A`), erro numa variável não derruba as outras.

**Vínculo + modo Jogar** — campo ↔ variável (ou "criar variável a partir do campo"); fórmula editável no próprio campo. No modo **Jogar** os campos funcionam: números com +/−, selects, indicadores, botões (somar/subtrair/definir/alternar), listas e tabelas editáveis. Textos aceitam `{Variável}`. Valores de jogo ficam salvos na ficha.

**Campos com fórmula própria** — qualquer campo numérico, barra ou indicador pode ter uma fórmula direto no painel (`10 + Nível * 2`), sem criar variável. Nomes com espaço funcionam **sem colchetes** (`Nova variável 2 * 2`), e `2,5` vale como decimal fora de funções.

**Rolagem de dados** — botão com ação *Rolar dados* (`1d20 + Força`, `4d6kh3`, `2d20kl1`), histórico no painel do jogador, resultado pode ser guardado numa variável.

**Aparência** — 5 temas (Grafite, Grimório, Arcano, Gelo, Pergaminho) no ícone de paleta; para criar outro, copie um bloco em `src/index.css` e registre em `src/stores/theme.ts`.

**Persistência** — autosave com debounce, sem gravações simultâneas, retentativa após falha, aviso ao fechar com pendências, controle de versão (detecta edição em outra aba e avisa em vez de sobrescrever).

## Atalhos

| | |
|---|---|
| V / H | selecionar / mão (ou segure Espaço) |
| T I B R N P | texto, imagem, caixa, forma, número, barra |
| Ctrl+Z / Ctrl+Shift+Z | desfazer / refazer |
| Ctrl+C / X / V / D | copiar, recortar, colar, duplicar |
| Ctrl+G / Ctrl+Shift+G | agrupar / desagrupar |
| Ctrl+] / [ (+Shift) | subir / descer camada (até o topo/fundo) |
| Ctrl+Shift+L / H | travar / ocultar |
| Setas (+Shift) | mover 1 px (10 px) |
| Ctrl+0 / 1 / + / − | zoom 100% / enquadrar / aproximar / afastar |
| Ctrl+' | grade · Ctrl+S gravar agora · Del excluir · Esc limpar |

## Arquitetura e justificativas

```
src/
  engine/formula/   motor de fórmulas (TS puro, sem UI)         ← testado
  editor/           cena, geometria, operações, canvas, painéis
    sceneOps.ts     operações PURAS sobre a cena (agrupar, alinhar…)  ← testado
    geometry.ts     rotação, resize com âncora, encaixe/guias         ← testado
  stores/           Zustand: editor (histórico), regras, avisos
  data/             Repository (interface) + Local (IndexedDB) + Supabase
  lib/              autosave, imagem, formatação
  pages/ components/
supabase/migrations/0001_init.sql
```

- **DOM/CSS em vez de Konva (desvio consciente do briefing).** Fichas têm campos numéricos, selects e botões que precisam funcionar de verdade; em canvas seria preciso reimplementar foco, teclado, seleção de texto e acessibilidade. Aqui o mesmo renderizador serve para editar e jogar. O custo: milhares de elementos pesariam mais que num canvas — irrelevante para fichas.
- **Cena = JSON plano** (`nodes` por id, `order` para camadas, `parentId`/`children` para grupos). Operações puras ⇒ histórico por snapshot com compartilhamento estrutural (sem Immer) e testes simples.
- **Repository único** com implementação local e Supabase: desenvolve-se e testa-se sem backend; trocar de backend não toca na interface.
- **Zustand** (não Redux): estado do editor muda a cada movimento do mouse, e seletores finos evitam re-render.
- **HashRouter**: hospedagem estática sem regra de rewrite.
- Tabelas de biblioteca, relações e documentos já existem no SQL para evitar migração quebrada depois.

## Limitações conhecidas (honestas)

- Redimensionar **vários** elementos ou grupos com elementos girados distorce os girados; girar só vale para elemento único (não grupo).
- Sem guias arrastáveis das réguas; sem encaixe durante redimensionamento (só ao mover).
- "Elementos personalizados" (componentes reutilizáveis) ainda não existem.
- Imagens vão como data URL (reduzidas a 1600 px) dentro do JSON da ficha. Para uso intenso, migrar para o Supabase Storage.
- Rolagens são ação de botão, não função de fórmula (fórmulas são determinísticas: recalcular não pode mudar o resultado).
- Registro de variáveis por usuário em modo local: sem sincronização entre dispositivos.

## Primeira execução — o que revisar

1. `npm install && npm run typecheck`: erros de tipos do React aparecem aqui (a checagem local usou stubs). Costumam ser ajustes de uma linha.
2. Abrir o editor e testar: criar elementos, mover, redimensionar, girar, agrupar, desfazer, zoom, modo Jogar com campos vinculados.
3. Com Supabase: criar conta, projeto, ficha, recarregar a página e conferir que tudo persiste.

## Biblioteca (etapa 7)

Categorias e campos são do autor: 17 categorias iniciais (Armas, Criaturas, Cidades…) são criadas uma única vez por projeto e podem ser renomeadas, alteradas ou apagadas. Cada categoria define seus campos (texto, texto longo, número, lista, sim/não, imagem, vínculo). Campos de vínculo ligam registros entre si e mostram "Mencionado em" no registro de destino. Limite atual: a biblioteca ainda não vai dentro do modelo enviado aos jogadores.

## Próximas etapas

8. Relações + grafo (React Flow) · 9. Documentação (TipTap, menções a registros).
