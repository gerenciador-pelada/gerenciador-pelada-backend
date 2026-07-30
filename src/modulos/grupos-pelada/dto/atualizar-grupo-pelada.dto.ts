import { PartialType } from '@nestjs/swagger';
import { CriarGrupoPeladaDto } from './criar-grupo-pelada.dto';

export class AtualizarGrupoPeladaDto extends PartialType(CriarGrupoPeladaDto) {}
