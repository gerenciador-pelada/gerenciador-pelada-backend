import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, ILike, Repository } from 'typeorm';
import { GrupoPeladaEntity } from '../../banco/entidades/grupo-pelada.entity';
import { PeladaEntity } from '../../banco/entidades/pelada.entity';
import { StatusPelada } from '../../comum/enums/status-pelada.enum';
import { AtualizarGrupoPeladaDto } from './dto/atualizar-grupo-pelada.dto';
import { CriarGrupoPeladaDto } from './dto/criar-grupo-pelada.dto';

export interface GrupoPeladaResumo {
  id: string;
  nome: string;
  quantidadeEdicoes: number;
  edicaoEmAndamento: PeladaEntity | null;
  proximaEdicao: PeladaEntity | null;
  edicoes: PeladaEntity[];
}

@Injectable()
export class GruposPeladaService {
  constructor(
    @InjectRepository(GrupoPeladaEntity)
    private readonly grupos: Repository<GrupoPeladaEntity>,
    private readonly fonteDados: DataSource,
  ) {}

  async criar(
    usuarioId: string,
    dto: CriarGrupoPeladaDto,
  ): Promise<GrupoPeladaEntity> {
    const nome = dto.nome.trim();
    await this.garantirNomeDisponivel(usuarioId, nome);

    return this.grupos.save(
      this.grupos.create({
        organizadorId: usuarioId,
        nome,
      }),
    );
  }

  async listar(usuarioId: string): Promise<GrupoPeladaResumo[]> {
    const grupos = await this.grupos.find({
      where: { organizadorId: usuarioId },
      relations: { edicoes: { local: true } },
    });

    return grupos
      .map((grupo) => this.montarResumo(grupo))
      .sort((a, b) => this.compararResumos(a, b));
  }

  async buscarPorId(usuarioId: string, id: string): Promise<GrupoPeladaEntity> {
    const grupo = await this.grupos.findOne({
      where: { id, organizadorId: usuarioId },
      relations: { edicoes: { local: true } },
    });
    if (!grupo) {
      throw new NotFoundException('Pelada nao encontrada');
    }
    return grupo;
  }

  async buscarResumo(
    usuarioId: string,
    id: string,
  ): Promise<GrupoPeladaResumo> {
    return this.montarResumo(await this.buscarPorId(usuarioId, id));
  }

  async atualizar(
    usuarioId: string,
    id: string,
    dto: AtualizarGrupoPeladaDto,
  ): Promise<GrupoPeladaEntity> {
    const grupo = await this.buscarPorId(usuarioId, id);
    if (dto.nome === undefined) return grupo;

    const nome = dto.nome.trim();
    if (nome === grupo.nome) return grupo;
    await this.garantirNomeDisponivel(usuarioId, nome, id);

    return this.fonteDados.transaction(async (gerenciador) => {
      grupo.nome = nome;
      const salvo = await gerenciador.save(GrupoPeladaEntity, grupo);
      await gerenciador.update(PeladaEntity, { grupoId: id }, { nome });
      return salvo;
    });
  }

  async remover(usuarioId: string, id: string): Promise<void> {
    const grupo = await this.buscarPorId(usuarioId, id);
    // Cascata: o grupo leva as edicoes junto, numa transacao.
    //
    // A regra anterior recusava excluir grupo com qualquer edicao, inclusive
    // ja excluida — o que prendia o grupo para sempre, porque apagar as
    // edicoes antes nao ajudava. Agora e um comando so.
    //
    // Isso apaga historico de verdade: as pontuacoes daquelas edicoes somem do
    // ranking (elas so contavam porque o join respeita `deletadoEm`). Quem
    // chama precisa ter confirmado com clareza — a interface pede o nome da
    // pelada digitado, e nao um "tem certeza?".
    await this.fonteDados.transaction(async (gerenciador) => {
      const edicoes = await gerenciador.find(PeladaEntity, {
        where: { grupoId: id },
      });
      if (edicoes.length > 0) {
        await gerenciador.softRemove(edicoes);
      }
      await gerenciador.softRemove(grupo);
    });
  }

  private montarResumo(grupo: GrupoPeladaEntity): GrupoPeladaResumo {
    const edicoes = [...(grupo.edicoes ?? [])].sort(
      (a, b) => b.dataHora.getTime() - a.dataHora.getTime(),
    );
    const agora = Date.now();
    const proximas = edicoes
      .filter(
        (edicao) =>
          edicao.status === StatusPelada.ABERTA_INSCRICOES &&
          edicao.dataHora.getTime() >= agora,
      )
      .sort((a, b) => a.dataHora.getTime() - b.dataHora.getTime());

    return {
      id: grupo.id,
      nome: grupo.nome,
      quantidadeEdicoes: edicoes.length,
      edicaoEmAndamento:
        edicoes.find((edicao) => edicao.status === StatusPelada.EM_ANDAMENTO) ??
        null,
      proximaEdicao: proximas[0] ?? null,
      edicoes,
    };
  }

  private compararResumos(a: GrupoPeladaResumo, b: GrupoPeladaResumo): number {
    if (a.edicaoEmAndamento && !b.edicaoEmAndamento) return -1;
    if (!a.edicaoEmAndamento && b.edicaoEmAndamento) return 1;

    const dataA =
      a.proximaEdicao?.dataHora.getTime() ?? Number.MAX_SAFE_INTEGER;
    const dataB =
      b.proximaEdicao?.dataHora.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (dataA !== dataB) return dataA - dataB;
    return a.nome.localeCompare(b.nome, 'pt-BR');
  }

  private async garantirNomeDisponivel(
    usuarioId: string,
    nome: string,
    ignorarId?: string,
  ): Promise<void> {
    const existente = await this.grupos.findOne({
      where: { organizadorId: usuarioId, nome: ILike(nome) },
    });
    if (existente && existente.id !== ignorarId) {
      throw new ConflictException('Ja existe uma pelada com este nome');
    }
  }
}
