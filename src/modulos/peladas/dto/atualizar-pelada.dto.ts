import { PartialType } from '@nestjs/swagger';
import { CriarPeladaDto } from './criar-pelada.dto';

export class AtualizarPeladaDto extends PartialType(CriarPeladaDto) {}
