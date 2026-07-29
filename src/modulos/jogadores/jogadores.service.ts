import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JogadorEntity } from '../../banco/entidades/jogador.entity';
import { ResultadoPaginado } from '../../comum/dto/resultado-paginado';
import { AtualizarJogadorDto } from './dto/atualizar-jogador.dto';
import { CriarJogadorDto } from './dto/criar-jogador.dto';
import { FiltrarJogadoresDto } from './dto/filtrar-jogadores.dto';

@Injectable()
export class JogadoresService {
  constructor(
    @InjectRepository(JogadorEntity)
    private readonly jogadores: Repository<JogadorEntity>,
  ) {}

  async criar(usuarioId: string, dto: CriarJogadorDto): Promise<JogadorEntity> {
    const nome = dto.nome.trim();
    await this.garantirNomeDisponivel(usuarioId, nome);

    const jogador = this.jogadores.create({
      usuarioId,
      nome,
      apelido: dto.apelido?.trim() ?? null,
      fotoUrl: dto.fotoUrl ?? null,
      posicaoPreferida: dto.posicaoPreferida,
      podeSerGoleiro: dto.podeSerGoleiro ?? false,
    });

    return this.jogadores.save(jogador);
  }

  async listar(
    usuarioId: string,
    filtro: FiltrarJogadoresDto,
  ): Promise<ResultadoPaginado<JogadorEntity>> {
    const construtor = this.jogadores
      .createQueryBuilder('jogador')
      .where('jogador.usuarioId = :usuarioId', { usuarioId });

    if (filtro.busca) {
      construtor.andWhere(
        '(jogador.nome ILIKE :busca OR jogador.apelido ILIKE :busca)',
        { busca: `%${filtro.busca.trim().toLowerCase()}%` },
      );
    }
    if (filtro.posicaoPreferida) {
      construtor.andWhere('jogador.posicaoPreferida = :posicao', {
        posicao: filtro.posicaoPreferida,
      });
    }
    if (filtro.podeSerGoleiro !== undefined) {
      construtor.andWhere('jogador.podeSerGoleiro = :goleiro', {
        goleiro: filtro.podeSerGoleiro,
      });
    }

    const [itens, total] = await construtor
      .orderBy('jogador.nome', 'ASC')
      .skip(filtro.pular)
      .take(filtro.limite)
      .getManyAndCount();

    return ResultadoPaginado.criar(itens, total, filtro.pagina, filtro.limite);
  }

  async buscarPorId(usuarioId: string, id: string): Promise<JogadorEntity> {
    const jogador = await this.jogadores.findOne({
      where: { id, usuarioId },
    });
    if (!jogador) {
      throw new NotFoundException('Jogador nao encontrado');
    }
    return jogador;
  }

  async atualizar(
    usuarioId: string,
    id: string,
    dto: AtualizarJogadorDto,
  ): Promise<JogadorEntity> {
    const jogador = await this.buscarPorId(usuarioId, id);

    if (dto.nome && dto.nome.trim() !== jogador.nome) {
      await this.garantirNomeDisponivel(usuarioId, dto.nome.trim());
      jogador.nome = dto.nome.trim();
    }
    if (dto.apelido !== undefined)
      jogador.apelido = dto.apelido?.trim() ?? null;
    if (dto.fotoUrl !== undefined) jogador.fotoUrl = dto.fotoUrl ?? null;
    if (dto.posicaoPreferida !== undefined)
      jogador.posicaoPreferida = dto.posicaoPreferida;
    if (dto.podeSerGoleiro !== undefined)
      jogador.podeSerGoleiro = dto.podeSerGoleiro;

    return this.jogadores.save(jogador);
  }

  async remover(usuarioId: string, id: string): Promise<void> {
    const jogador = await this.buscarPorId(usuarioId, id);
    await this.jogadores.softRemove(jogador);
  }

  private async garantirNomeDisponivel(
    usuarioId: string,
    nome: string,
  ): Promise<void> {
    const existente = await this.jogadores.findOne({
      where: { usuarioId, nome },
    });
    if (existente) {
      throw new ConflictException('Ja existe um jogador com este nome');
    }
  }
}
