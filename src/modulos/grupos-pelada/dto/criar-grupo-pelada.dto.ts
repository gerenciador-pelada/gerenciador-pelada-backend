import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class CriarGrupoPeladaDto {
  @ApiProperty({ example: 'Pelada de quarta' })
  @IsString()
  @Length(2, 120, { message: 'nome deve ter entre 2 e 120 caracteres' })
  nome: string;
}
