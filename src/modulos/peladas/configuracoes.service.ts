import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfiguracaoPeladaEntity } from '../../banco/entidades/configuracao-pelada.entity';
import { PeladaEntity } from '../../banco/entidades/pelada.entity';
import { StatusPelada } from '../../comum/enums/status-pelada.enum';
import { ErroRegraPelada } from '../../dominio/erros/erro-regra-pelada';
import { MaquinaStatusPelada } from '../../dominio/pelada/maquina-status-pelada';
import { AtualizarConfiguracaoDto } from './dto/atualizar-configuracao.dto';

const CAMPOS_ESTRUTURAIS = [
  'jogadoresLinhaPorTime',
  'quantidadeGoleiros',
  'modalidadeGoleiro',
  'formaEscolhaTimesIniciais',
] as const;

type CampoEstrutural = (typeof CAMPOS_ESTRUTURAIS)[number];

@Injectable()
export class ConfiguracoesService {
  constructor(
    @InjectRepository(PeladaEntity)
    private readonly peladas: Repository<PeladaEntity>,
    @InjectRepository(ConfiguracaoPeladaEntity)
    private readonly configuracoes: Repository<ConfiguracaoPeladaEntity>,
  ) {}

  async buscar(
    usuarioId: string,
    peladaId: string,
  ): Promise<ConfiguracaoPeladaEntity> {
    return (await this.carregarPelada(usuarioId, peladaId)).configuracao;
  }

  async atualizar(
    usuarioId: string,
    peladaId: string,
    dto: AtualizarConfiguracaoDto,
  ): Promise<ConfiguracaoPeladaEntity> {
    const pelada = await this.carregarPelada(usuarioId, peladaId);
    const configuracao = pelada.configuracao;

    if (MaquinaStatusPelada.estaEncerrada(pelada.status)) {
      throw new ErroRegraPelada(
        'CONFIGURACAO_PELADA_ENCERRADA',
        'Nao e possivel alterar a configuracao de uma pelada encerrada',
        { status: pelada.status },
      );
    }

    if (pelada.status === StatusPelada.EM_ANDAMENTO) {
      this.garantirEstruturaIntacta(configuracao, dto);
    }

    Object.assign(configuracao, dto);
    return this.configuracoes.save(configuracao);
  }

  private garantirEstruturaIntacta(
    configuracao: ConfiguracaoPeladaEntity,
    dto: AtualizarConfiguracaoDto,
  ): void {
    const alterados = CAMPOS_ESTRUTURAIS.filter((campo: CampoEstrutural) => {
      const novo = dto[campo];
      return novo !== undefined && novo !== configuracao[campo];
    });

    if (alterados.length > 0) {
      throw new ErroRegraPelada(
        'CONFIGURACAO_ESTRUTURAL_TRAVADA',
        'A estrutura dos times nao pode mudar com a pelada em andamento',
        { campos: alterados },
      );
    }
  }

  private async carregarPelada(
    usuarioId: string,
    peladaId: string,
  ): Promise<PeladaEntity> {
    const pelada = await this.peladas.findOne({
      where: { id: peladaId, organizadorId: usuarioId },
      relations: ['configuracao'],
    });
    if (!pelada) {
      throw new NotFoundException('Pelada nao encontrada');
    }
    return pelada;
  }
}
