import { PartialType } from '@nestjs/swagger';
import { CriarJogadorDto } from './criar-jogador.dto';

export class AtualizarJogadorDto extends PartialType(CriarJogadorDto) {}
