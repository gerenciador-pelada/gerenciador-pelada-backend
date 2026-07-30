import { AdicionarChavesEstrangeiras1785381200518 } from './migracoes/1785381200518-AdicionarChavesEstrangeiras';
import { AdicionarGoleirosAvulsosPartida1785427000000 } from './migracoes/1785427000000-AdicionarGoleirosAvulsosPartida';
import { AdicionarPausaNaPartida1785500000000 } from './migracoes/1785500000000-AdicionarPausaNaPartida';
import { AdicionarVencedorDecisaoPartida1785425000000 } from './migracoes/1785425000000-AdicionarVencedorDecisaoPartida';
import { CriarFilaJogadores1785421000000 } from './migracoes/1785421000000-CriarFilaJogadores';
import { CriarGruposPelada1785426000000 } from './migracoes/1785426000000-CriarGruposPelada';
import { CriarHistoricoAcoes1785424000000 } from './migracoes/1785424000000-CriarHistoricoAcoes';
import { CriarJogadores1785336482135 } from './migracoes/1785336482135-CriarJogadores';
import { CriarLocaisPelada1785336854836 } from './migracoes/1785336854836-CriarLocaisPelada';
import { CriarParticipantesPelada1785420000000 } from './migracoes/1785420000000-CriarParticipantesPelada';
import { CriarPartidasEEventos1785422000000 } from './migracoes/1785422000000-CriarPartidasEEventos';
import { CriarPeladasEConfiguracoes1785338893590 } from './migracoes/1785338893590-CriarPeladasEConfiguracoes';
import { CriarPontuacoesJogador1785423000000 } from './migracoes/1785423000000-CriarPontuacoesJogador';
import { CriarTemporadas1785337017320 } from './migracoes/1785337017320-CriarTemporadas';
import { CriarTimesEJogadoresTime1785350855165 } from './migracoes/1785350855165-CriarTimesEJogadoresTime';
import { CriarUsuarios1785334990046 } from './migracoes/1785334990046-CriarUsuarios';

/**
 * Referencias estaticas garantem que bundlers de producao incluam as
 * migrations no artefato. Um glob de filesystem pode ficar vazio depois que
 * a hospedagem elimina arquivos que nao aparecem na arvore de imports.
 */
export const MIGRACOES = [
  CriarUsuarios1785334990046,
  CriarJogadores1785336482135,
  CriarLocaisPelada1785336854836,
  CriarTemporadas1785337017320,
  CriarPeladasEConfiguracoes1785338893590,
  CriarTimesEJogadoresTime1785350855165,
  AdicionarChavesEstrangeiras1785381200518,
  CriarParticipantesPelada1785420000000,
  CriarFilaJogadores1785421000000,
  CriarPartidasEEventos1785422000000,
  CriarPontuacoesJogador1785423000000,
  CriarHistoricoAcoes1785424000000,
  AdicionarVencedorDecisaoPartida1785425000000,
  CriarGruposPelada1785426000000,
  AdicionarGoleirosAvulsosPartida1785427000000,
  AdicionarPausaNaPartida1785500000000,
];
