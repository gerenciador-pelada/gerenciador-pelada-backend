import { PartialType } from '@nestjs/swagger';
import { CriarTemporadaDto } from './criar-temporada.dto';

export class AtualizarTemporadaDto extends PartialType(CriarTemporadaDto) {}
