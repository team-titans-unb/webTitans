# print-upload-abuse-protection Specification

## Purpose

Limitar o abuso de upload via anon key restringindo o bucket `pdfs-impressao` no próprio Supabase Storage (apenas `application/pdf`, máximo 30 MB), de modo que essas regras valham mesmo numa chamada direta à API, e garantindo que `anon` só possa inserir arquivos — nunca listar, ler ou baixar. Uploads órfãos (sem pagamento) são descartados pela limpeza de 1 hora.

## Requirements
### Requirement: Bucket restringe tipo e tamanho de arquivo

O bucket `pdfs-impressao` SHALL ter `allowed_mime_types = ['application/pdf']` e `file_size_limit = 31457280` (30 MB) configurados no nível do bucket, de modo que uploads que violem essas regras sejam rejeitados pelo próprio Supabase Storage, independentemente de validação no cliente. O teto de 30 MB também garante que o `create-pix` consiga baixar e contar as páginas dentro do limite de tempo da Vercel.

#### Scenario: Upload de não-PDF rejeitado pelo bucket
- **WHEN** uma chamada à API de Storage tenta subir um arquivo com content-type `image/png`
- **THEN** o Supabase rejeita o upload

#### Scenario: Upload acima de 30 MB rejeitado pelo bucket
- **WHEN** uma chamada tenta subir um arquivo de 50 MB
- **THEN** o Supabase rejeita o upload

#### Scenario: Upload de PDF válido aceito
- **WHEN** o cliente sobe um PDF de 5 MB
- **THEN** o upload é aceito

### Requirement: Uploads órfãos têm vida curta

O sistema SHALL garantir que arquivos enviados sem pagamento correspondente não persistam indefinidamente, removendo-os via a limpeza de pedidos não pagos (1 hora).

#### Scenario: Upload sem pedido pago é descartado
- **WHEN** um PDF é enviado e o pedido associado fica `AGUARDANDO_PAGAMENTO` por mais de 1 hora
- **THEN** a limpeza remove o arquivo do Storage

### Requirement: anon não lê nem lista arquivos do bucket

O role `anon` SHALL ter permissão apenas de INSERT no bucket `pdfs-impressao`; SELECT, LIST, UPDATE e DELETE SHALL ser negados, de forma que um terceiro não consiga baixar ou enumerar PDFs de outros usuários.

#### Scenario: Tentativa de listar o bucket
- **WHEN** alguém com a anon key chama `storage.from('pdfs-impressao').list()`
- **THEN** retorna vazio ou 403

#### Scenario: Tentativa de baixar PDF alheio
- **WHEN** alguém tenta `GET` público de um objeto do bucket
- **THEN** o acesso é negado (bucket privado)

