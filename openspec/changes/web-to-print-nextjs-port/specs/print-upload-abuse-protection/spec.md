## MODIFIED Requirements

### Requirement: Bucket restringe tipo e tamanho de arquivo

O bucket `pdfs-impressao` SHALL ter `allowed_mime_types = ['application/pdf']` e `file_size_limit = 31457280` (30 MB) configurados no nível do bucket, de modo que uploads que violem essas regras sejam rejeitados pelo próprio Supabase Storage, independentemente de validação no cliente. O teto de 30 MB também garante que o `create-pix` (Next.js Route Handler, `runtime = "nodejs"`) consiga baixar e contar as páginas com folga dentro do limite de tempo da função serverless da Vercel (~10 s) onde o endpoint roda em produção.

#### Scenario: Upload de não-PDF rejeitado pelo bucket
- **WHEN** uma chamada à API de Storage tenta subir um arquivo com content-type `image/png`
- **THEN** o Supabase rejeita o upload

#### Scenario: Upload acima de 30 MB rejeitado pelo bucket
- **WHEN** uma chamada tenta subir um arquivo de 50 MB
- **THEN** o Supabase rejeita o upload

#### Scenario: Upload de PDF válido aceito
- **WHEN** o cliente sobe um PDF de 5 MB
- **THEN** o upload é aceito
