## MODIFIED Requirements

### Requirement: Políticas RLS para SELECT por id e bloqueio de UPDATE/DELETE anônimo

O Supabase SHALL permitir ao role `anon` `SELECT` em `fila_impressao` apenas quando o cliente fornece o `id` da linha (recuperado da própria sessão), e SHALL **negar** todo `UPDATE` e `DELETE` para `anon`. UPDATEs SHALL ser feitos exclusivamente via `service_role` no Route Handler `app/api/webhooks/mercadopago/route.ts` (Next.js, `runtime = "nodejs"`).

#### Scenario: Cliente verifica status do próprio pedido
- **WHEN** o frontend chama `select * from fila_impressao where id = <seu-uuid>`
- **THEN** retorna a linha

#### Scenario: Cliente tenta mudar status para PAGO
- **WHEN** o frontend tenta `update fila_impressao set status='PAGO' where id=...` com anon
- **THEN** a RLS bloqueia (0 rows affected, sem erro silencioso? — deve retornar erro 403)
