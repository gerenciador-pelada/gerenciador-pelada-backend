import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { StatusPelada } from '../../../comum/enums/status-pelada.enum';

export class AlterarStatusDto {
  @ApiProperty({ enum: StatusPelada })
  @IsEnum(StatusPelada, { message: 'status invalido' })
  status: StatusPelada;
}
