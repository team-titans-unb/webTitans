# Tasks — prevent-garbled-prints

## 1. Purga de jobs órfãos do spool CUPS

- [x] 1.1 Implementar `purgar_spool(filas: list[str])` em `print-worker/worker.py`: executa
      `cancel -a <fila>` (env `CUPS_ENV`, timeout curto) para cada fila candidata; falhas viram
      `log.warning` e nunca propagam exceção
- [x] 1.2 Chamar a purga no boot: em `main()`, após criar a config e antes do primeiro ciclo,
      purgar todas as `filas_candidatas(cfg)` e logar o resultado
- [x] 1.3 Chamar a purga pré-submissão: no início de `processar()` (antes do download do PDF),
      purgar todas as filas candidatas; garantir por construção que nenhuma purga ocorre entre
      `enviar_para_impressora` e o fim de `aguardar_conclusao`/`cancelar_job`

## 2. Gate de prontidão via printer-state IPP

- [x] 2.1 Adicionar `printer-state` ao `requested-attributes` de `ARQUIVO_IPP_SAUDE` e extrair o
      valor (enum 3/4/5) em `_parse_atributos_ipp` (campo `printer_state`, None se ausente),
      tolerando saída em texto do ipptool (ex.: `printer-state (enum) = idle`/`= 3`)
- [x] 2.2 Implementar `impressora_pronta(cfg, fila) -> bool | None`: consulta o device URI direto
      (reutilizando `alvo_ipp_da_fila` + `_uri_com_host_resolvido` + `_consultar_ipp`); True se
      `printer-state = 3`; False se 4/5 ou consulta ao equipamento falhou com TCP alcançável;
      None (degrada) se ipptool ausente, fila USB/local ou único alvo é a fila CUPS local
- [x] 2.3 Integrar ao gate pré-submissão em `processar()`: após `fila_alcancavel`, tratar
      `impressora_pronta(...) is False` como falha de pré-submissão (log + `continue` para a
      próxima fila), preservando failover e retenção existentes; estado de firmware também
      alimenta `estado_da_fila` (retenção segura pedidos em PAGO) e a checagem de fallback em
      `deve_segurar_pedidos`
- [x] 2.4 Garantir que o heartbeat/`saude_da_impressora` continua funcionando com o atributo novo
      no mesmo arquivo IPP (parsing existente inalterado nos campos atuais)

## 3. Verificação e documentação

- [x] 3.1 Testes manuais/roteirizados dos parsers: `_parse_atributos_ipp` com e sem
      `printer-state`, valores 3/4/5 e ausência do atributo (22 testes em
      `print-worker/test_worker_parsers.py`, todos passando)
- [ ] 3.2 Teste de bancada (máquina do lab): job órfão simulado (`lp` manual + interromper rede)
      é purgado no ciclo seguinte, sem lixo impresso; religar a impressora com pedido PAGO
      pendente resulta em "não pronto" nos logs até o idle e impressão limpa em seguida
- [x] 3.3 Atualizar `print-worker/README` (ou doc equivalente): fila CUPS é de uso exclusivo do
      worker (a purga cancela jobs manuais), novo gate de prontidão e como diagnosticá-lo nos logs
