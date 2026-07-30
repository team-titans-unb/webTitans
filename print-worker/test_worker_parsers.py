"""Testes de regressão para os parsers IPP do print-worker.

Cobre `_parse_atributos_ipp`, `normalizar_razoes` e `estado_de_saude` a partir
de saídas simuladas do `ipptool -tv` (nenhum comando externo é executado —
os testes só exercitam o parsing puro em Python). Usa apenas a stdlib
(unittest), sem dependências novas.

O import de `worker` é seguro: `main()` só roda sob
`if __name__ == "__main__":`, então importar o módulo não sobe threads, não
lê variáveis de ambiente obrigatórias e não instancia `Config`.
"""

from __future__ import annotations

import os
import sys
import unittest

# Garante que `worker` seja importável mesmo rodando de outro diretório
# (ex.: `python3 /caminho/para/test_worker_parsers.py`).
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import worker  # noqa: E402 - import após o ajuste do sys.path acima


class ParseAtributosIppTests(unittest.TestCase):
    """`_parse_atributos_ipp`: extração de printer-state, razões e toner."""

    def test_saida_completa_idle(self) -> None:
        """idle + state-reasons + marker-levels: os três campos são extraídos."""
        saida = (
            "ipptool: ... (Get-Printer-Attributes) ...\n"
            "printer-state (enum) = idle\n"
            "printer-state-reasons (keyword) = none\n"
            "marker-levels (integer) = 87\n"
        )
        atributos = worker._parse_atributos_ipp(saida)
        self.assertEqual(atributos["printer_state"], worker.IDLE)
        self.assertEqual(atributos["state_reasons"], ["none"])
        self.assertEqual(atributos["toner_pct"], 87)

    def test_processing_por_nome(self) -> None:
        saida = "printer-state (enum) = processing\n"
        atributos = worker._parse_atributos_ipp(saida)
        self.assertEqual(atributos["printer_state"], worker.PROCESSING)

    def test_stopped_por_nome(self) -> None:
        saida = "printer-state (enum) = stopped\n"
        atributos = worker._parse_atributos_ipp(saida)
        self.assertEqual(atributos["printer_state"], worker.STOPPED)

    def test_formato_numerico_idle(self) -> None:
        """Algumas versões do ipptool imprimem o número do enum em vez do nome."""
        saida = "printer-state (enum) = 3\n"
        atributos = worker._parse_atributos_ipp(saida)
        self.assertEqual(atributos["printer_state"], 3)

    def test_formato_numerico_stopped(self) -> None:
        saida = "printer-state (enum) = 5\n"
        atributos = worker._parse_atributos_ipp(saida)
        self.assertEqual(atributos["printer_state"], 5)

    def test_sem_printer_state_nao_confunde_com_reasons(self) -> None:
        """Só `printer-state-reasons` na saída (sem `printer-state`):
        printer_state deve ficar None — a regex de `printer-state` não pode
        casar acidentalmente com o prefixo de `printer-state-reasons`."""
        saida = "printer-state-reasons (keyword) = media-empty-error\n"
        atributos = worker._parse_atributos_ipp(saida)
        self.assertIsNone(atributos["printer_state"])
        self.assertEqual(atributos["state_reasons"], ["media-empty-error"])

    def test_reasons_antes_do_state_nao_confunde(self) -> None:
        """Mesmo com `-reasons` aparecendo ANTES de `printer-state` na saída,
        o valor extraído deve ser o do atributo `printer-state` de verdade."""
        saida = (
            "printer-state-reasons (keyword) = none\n"
            "printer-state (enum) = idle\n"
        )
        atributos = worker._parse_atributos_ipp(saida)
        self.assertEqual(atributos["printer_state"], worker.IDLE)

    def test_marker_levels_negativo_vira_none(self) -> None:
        """-1 é o valor IPP para 'desconhecido' -> toner_pct deve virar None."""
        saida = "marker-levels (integer) = -1\n"
        atributos = worker._parse_atributos_ipp(saida)
        self.assertIsNone(atributos["toner_pct"])

    def test_saida_vazia(self) -> None:
        atributos = worker._parse_atributos_ipp("")
        self.assertEqual(atributos["state_reasons"], [])
        self.assertIsNone(atributos["toner_pct"])
        self.assertIsNone(atributos["toner_low_pct"])
        self.assertIsNone(atributos["printer_state"])

    def test_saida_ilegivel(self) -> None:
        """Texto sem nenhum atributo IPP reconhecível: tudo vazio/None."""
        saida = "@#$% saída corrompida do ipptool, nada reconhecível aqui %#@"
        atributos = worker._parse_atributos_ipp(saida)
        self.assertEqual(atributos["state_reasons"], [])
        self.assertIsNone(atributos["toner_pct"])
        self.assertIsNone(atributos["toner_low_pct"])
        self.assertIsNone(atributos["printer_state"])


class NormalizarRazoesTests(unittest.TestCase):
    """`normalizar_razoes`: remove sufixos de severidade e ruído ('none')."""

    def test_remove_sufixos_de_severidade(self) -> None:
        razoes = ["media-empty-error", "toner-empty-warning", "media-jam-report"]
        self.assertEqual(
            worker.normalizar_razoes(razoes),
            ["media-empty", "toner-empty", "media-jam"],
        )

    def test_filtra_none(self) -> None:
        self.assertEqual(worker.normalizar_razoes(["none"]), [])

    def test_preserva_razoes_sem_sufixo_conhecido(self) -> None:
        self.assertEqual(worker.normalizar_razoes(["cover-open"]), ["cover-open"])

    def test_preserva_ordem_e_mistura_casos(self) -> None:
        razoes = ["none", "media-jam-report", "toner-empty"]
        self.assertEqual(worker.normalizar_razoes(razoes), ["media-jam", "toner-empty"])

    def test_lista_vazia(self) -> None:
        self.assertEqual(worker.normalizar_razoes([]), [])


class EstadoDeSaudeTests(unittest.TestCase):
    """`estado_de_saude`: mapeia razões normalizadas + toner para o estado físico."""

    def test_toner_empty_vira_sem_toner(self) -> None:
        estado = worker.estado_de_saude(["toner-empty"], None, None)
        self.assertEqual(estado, "SEM_TONER")

    def test_media_empty_vira_sem_papel(self) -> None:
        estado = worker.estado_de_saude(["media-empty"], None, None)
        self.assertEqual(estado, "SEM_PAPEL")

    def test_media_jam_vira_manutencao(self) -> None:
        estado = worker.estado_de_saude(["media-jam"], None, None)
        self.assertEqual(estado, "MANUTENCAO")

    def test_sem_razoes_e_toner_normal_retorna_none(self) -> None:
        self.assertIsNone(worker.estado_de_saude([], 80, 10))

    def test_prioridade_toner_sobre_papel(self) -> None:
        """SEM_TONER tem prioridade sobre SEM_PAPEL quando ambas as razões
        aparecem simultaneamente (toner é a falha mais crítica)."""
        estado = worker.estado_de_saude(["toner-empty", "media-empty"], None, None)
        self.assertEqual(estado, "SEM_TONER")

    def test_toner_pct_zero_conta_como_esgotado(self) -> None:
        """Firmwares que não emitem 'toner-empty' mas zeram o percentual."""
        self.assertEqual(worker.estado_de_saude([], 0, None), "SEM_TONER")

    def test_toner_pct_no_limiar_low_conta_como_esgotado(self) -> None:
        """toner_pct <= toner_low_pct do próprio equipamento também é esgotado."""
        self.assertEqual(worker.estado_de_saude([], 5, 10), "SEM_TONER")


class LinhasDeTransicaoTests(unittest.TestCase):
    """`linhas_de_transicao`: avisos de entrada em problema e de recuperação."""

    def test_entrada_em_sem_papel_notifica_e_registra_pendente(self) -> None:
        linhas, pendente = worker.linhas_de_transicao("OK", "SEM_PAPEL", None, False, False)
        self.assertEqual(linhas, [worker.MENSAGEM_ESTADO["SEM_PAPEL"]])
        self.assertEqual(pendente, "SEM_PAPEL")

    def test_heartbeat_repetido_do_mesmo_estado_nao_repete(self) -> None:
        linhas, pendente = worker.linhas_de_transicao(
            "SEM_PAPEL", "SEM_PAPEL", "SEM_PAPEL", False, False
        )
        self.assertEqual(linhas, [])
        self.assertEqual(pendente, "SEM_PAPEL")

    def test_reentrada_apos_blip_inalcancavel_nao_repete(self) -> None:
        """SEM_PAPEL -> INALCANCAVEL -> SEM_PAPEL (Wi-Fi caiu e voltou, papel
        continua em falta): o problema pendente deduplica o aviso."""
        linhas, pendente = worker.linhas_de_transicao(
            "INALCANCAVEL", "SEM_PAPEL", "SEM_PAPEL", False, False
        )
        self.assertEqual(linhas, [])
        self.assertEqual(pendente, "SEM_PAPEL")

    def test_recuperacao_para_ok_avisa_papel_reposto(self) -> None:
        linhas, pendente = worker.linhas_de_transicao(
            "SEM_PAPEL", "OK", "SEM_PAPEL", False, False
        )
        self.assertEqual(linhas, [worker.MENSAGEM_RECUPERACAO["SEM_PAPEL"]])
        self.assertIsNone(pendente)

    def test_recuperacao_para_imprimindo_tambem_conta(self) -> None:
        linhas, pendente = worker.linhas_de_transicao(
            "SEM_TONER", "IMPRIMINDO", "SEM_TONER", False, False
        )
        self.assertEqual(linhas, [worker.MENSAGEM_RECUPERACAO["SEM_TONER"]])
        self.assertIsNone(pendente)

    def test_inalcancavel_nao_encerra_problema_pendente(self) -> None:
        """Impressora desligada não prova reposição: pendente sobrevive."""
        linhas, pendente = worker.linhas_de_transicao(
            "SEM_PAPEL", "INALCANCAVEL", "SEM_PAPEL", False, False
        )
        self.assertEqual(linhas, [])
        self.assertEqual(pendente, "SEM_PAPEL")

    def test_pausada_nao_encerra_problema_pendente(self) -> None:
        linhas, pendente = worker.linhas_de_transicao(
            "SEM_PAPEL", "PAUSADA", "SEM_PAPEL", False, False
        )
        self.assertEqual(linhas, [])
        self.assertEqual(pendente, "SEM_PAPEL")

    def test_troca_de_problema_notifica_o_novo(self) -> None:
        linhas, pendente = worker.linhas_de_transicao(
            "SEM_PAPEL", "SEM_TONER", "SEM_PAPEL", False, False
        )
        self.assertEqual(linhas, [worker.MENSAGEM_ESTADO["SEM_TONER"]])
        self.assertEqual(pendente, "SEM_TONER")

    def test_ok_sem_problema_pendente_nao_avisa(self) -> None:
        linhas, pendente = worker.linhas_de_transicao("OK", "OK", None, False, False)
        self.assertEqual(linhas, [])
        self.assertIsNone(pendente)

    def test_toner_baixo_subindo_avisa_uma_vez(self) -> None:
        linhas, _ = worker.linhas_de_transicao("OK", "OK", None, False, True)
        self.assertEqual(len(linhas), 1)
        self.assertIn("Toner acabando", linhas[0])
        linhas, _ = worker.linhas_de_transicao("OK", "OK", None, True, True)
        self.assertEqual(linhas, [])

    def test_entrada_em_problema_com_toner_baixo_junta_as_linhas(self) -> None:
        linhas, pendente = worker.linhas_de_transicao("OK", "SEM_PAPEL", None, False, True)
        self.assertEqual(len(linhas), 2)
        self.assertEqual(linhas[0], worker.MENSAGEM_ESTADO["SEM_PAPEL"])
        self.assertIn("Toner acabando", linhas[1])
        self.assertEqual(pendente, "SEM_PAPEL")


if __name__ == "__main__":
    unittest.main()
