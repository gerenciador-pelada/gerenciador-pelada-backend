import { PartialType } from '@nestjs/swagger';
import { CriarLocalDto } from './criar-local.dto';

export class AtualizarLocalDto extends PartialType(CriarLocalDto) {}
