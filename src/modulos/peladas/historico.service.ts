import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { EventoPartidaEntity } from '../../banco/entidades/evento-partida.entity';
import { HistoricoAcaoEntity } from '../../banco/entidades/historico-acao.entity';
import { PartidaEntity } from '../../banco/entidades/partida.entity';
import { TipoEventoPartida } from '../../comum/enums/tipo-evento-partida.enum';
import { ErroRegraPelada } from '../../dominio/erros/erro-regra-pelada';
import { AcessoPeladaService } from './acesso-pelada.service';

/** Ações que o histórico registra e o desfazer sabe reverter. */
export const ACAO_REGISTRO_EVENTO = 'REGISTRO_EVENTO';

interface DadosEvento {
  eventoId: string;
  partidaId: string;
  tipo: TipoEventoPartida;
  timeId: string;
  descricao: string;
}

@Injectable()
export class HistoricoService {
  constructor(
    @InjectRepository(HistoricoAcaoEntity)
    private readonly historico: Repository<HistoricoAcaoEntity>,
    private readonly acesso: AcessoPeladaService,
    private readonly fonteDados: DataSource,
  ) {}

  async listar(usuarioId: string, peladaId: string) {
    await this.acesso.garantirPelada(usuarioId, peladaId);
    return this.historico.find({
      where: { peladaId },
      order: { criadoEm: 'DESC' },
      take: 50,
    });
  }

  async registrar(
    peladaId: string,
    usuarioId: string,
    acao: string,
    dadosPosteriores: Record<string, unknown>,
  ) {
    return this.historico.save(
      this.historico.create({
        peladaId,
        usuarioId,
        acao,
        snapshotEstado: {},
        dadosAnteriores: null,
        dadosPosteriores,
        desfeitaEm: null,
      }),
    );
  }

  /**
   * Desfaz a última ação registrada.
   *
   * Hoje cobre o registro de evento, que é o que o organizador de fato erra no
   * calor do jogo — gol atribuído ao jogador errado. O evento sofre exclusão
   * lógica e o placar volta atrás, tudo numa transação.
   *
   * Ações que ainda não sabem se reverter recusam explicitamente, em vez de
   * marcar como desfeita e não fazer nada — um desfazer que mente é pior que
   * um desfazer que não existe.
   */
  async desfazer(usuarioId: string, peladaId: string) {
    await this.acesso.garantirPelada(usuarioId, peladaId);

    const acao = await this.historico.findOne({
      where: { peladaId, desfeitaEm: IsNull() },
      order: { criadoEm: 'DESC' },
    });
    if (!acao) {
      throw new ErroRegraPelada(
        'NADA_PARA_DESFAZER',
        'Não há nenhuma ação recente para desfazer',
      );
    }

    if (acao.acao !== ACAO_REGISTRO_EVENTO) {
      throw new ErroRegraPelada(
        'ACAO_NAO_REVERSIVEL',
        `Esta ação não pode ser desfeita automaticamente: ${acao.acao}`,
        { acao: acao.acao },
      );
    }

    const dados = acao.dadosPosteriores as unknown as DadosEvento;

    return this.fonteDados.transaction(async (gerenciador) => {
      const evento = await gerenciador.findOne(EventoPartidaEntity, {
        where: { id: dados.eventoId },
      });
      if (!evento) {
        throw new NotFoundException('O evento já não existe mais');
      }

      await gerenciador.softRemove(evento);

      if (
        dados.tipo === TipoEventoPartida.GOL ||
        dados.tipo === TipoEventoPartida.GOL_CONTRA
      ) {
        const partida = await gerenciador.findOne(PartidaEntity, {
          where: { id: dados.partidaId },
        });
        if (partida) {
          if (dados.timeId === partida.timeCasaId) {
            partida.golsCasa = Math.max(0, partida.golsCasa - 1);
          } else {
            partida.golsVisitante = Math.max(0, partida.golsVisitante - 1);
          }
          await gerenciador.save(partida);
        }
      }

      acao.desfeitaEm = new Date();
      await gerenciador.save(acao);

      return { desfeita: acao.acao, descricao: dados.descricao };
    });
  }
}
