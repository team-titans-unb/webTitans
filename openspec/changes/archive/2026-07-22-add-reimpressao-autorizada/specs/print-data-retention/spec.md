# Delta — print-data-retention (add-reimpressao-autorizada)

## ADDED Requirements

### Requirement: Limpeza de tokens de reimpressão expirados

A Edge Function `cleanup-fila` SHALL, na mesma execução periódica (no mínimo de hora em
hora), remover de `reimpressao_tokens` as linhas que já não têm utilidade: tokens
`expira_em < now()` ou com `usado_em` preenchido há mais de uma janela curta (ex.: 24h).
A limpeza SHALL preservar tokens ainda válidos (não expirados e não usados). Essa remoção
NÃO SHALL afetar a retenção de PDFs nem as demais regras já definidas.

#### Scenario: Token expirado é removido
- **WHEN** existe um `reimpressao_tokens` com `expira_em` no passado
- **THEN** na próxima execução da limpeza a linha é removida

#### Scenario: Token usado antigo é removido
- **WHEN** existe um token com `usado_em` preenchido há mais da janela de retenção curta
- **THEN** a limpeza remove a linha

#### Scenario: Token ainda válido é preservado
- **WHEN** existe um token não expirado e ainda não usado
- **THEN** a limpeza não o toca
