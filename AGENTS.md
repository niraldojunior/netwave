# AGENTS.md — Guia para Agentes de IA no Repositório V.tal netWave

Este arquivo instrui qualquer agente de IA que atue neste repositório. O netWave é o orquestrador corporativo de migração física em massa de clientes M&A para a rede neutra V.tal.

---

## 1. Princípios Mandatórios e Regras de Negócio Inegociáveis

1. **Granularidade 1 : 1 : 1:**
   `1 Cliente = 1 OS Individual = 1 SA Individual`
   Nunca agrupar múltiplos clientes em uma única OS. Comandos em lote mantêm a individualidade de cada cliente na máquina de estados.

2. **Reaproveitamento de ONT e Rastreabilidade de Serial:**
   Reutilizar a ONT física existente. Manter estritamente separados:
   - `ontSerialOriginal`: serial recebido no lote do M&A (imutável);
   - `ontSerialEffective`: serial validado ou corrigido em campo.
   Toda correção de serial exige registro auditável em `NW_SERIAL_CHANGE`.

3. **Pool Segregado e Técnico Buffer:**
   Técnicos de campanha pertencem ao pool `MIGRATION_CAMPAIGN` e não concorrem com atendimento BAU. Toda ordem recém-gerada é inicialmente associada ao técnico buffer da campanha para impedir despacho automático.

4. **Planejamento Centrado na CDO / CDOI:**
   A unidade primária de planejamento de rotas de campo é a caixa (CDO/CDOI). A tela de programação de campo deve priorizar a visualização em lista tabular de caixas.

5. **Nomenclatura Oracle Obrigatória:**
   Todas as tabelas e objetos de banco de dados criados para esta solução devem obrigatoriamente iniciar com o prefixo **`NW_`** em `UPPER_SNAKE_CASE` (`NW_MA`, `NW_MIGRATION_CAMPAIGN`, `NW_MIGRATION_LOT`, `NW_MIGRATION_ITEM`, `NW_CAMPAIGN_TECHNICIAN`, `NW_BOX_SCHEDULE`, `NW_BOX_SCHEDULE_HISTORY`, `NW_SERIAL_CHANGE`, `NW_OS_BATCH`, `NW_CUTOVER_BATCH`, `NW_CUTOVER_ITEM`, `NW_ROLLBACK`, `NW_AUDIT_LOG`).

---

## 2. Comandos Principais

| Comando | O que faz |
| --- | --- |
| `npm test` | Executa a suíte completa de testes no Vitest |
| `npm run test:scenarios` | Executa a validação dos 6 cenários mandatórios de negócio |
| `npm run build` | Compila o backend TypeScript para `dist/` |
| `npm run web:build` | Compila o frontend Vite para `dist/web/` |
| `npm run dev` | Inicializa a stack local completa via `start-dev.ps1` |

---

## 3. Isolamento com outros Repositórios

O projeto `netwave` é 100% autônomo. Nunca execute comandos de escrita ou alterações de código no diretório irmão `nexus`.
