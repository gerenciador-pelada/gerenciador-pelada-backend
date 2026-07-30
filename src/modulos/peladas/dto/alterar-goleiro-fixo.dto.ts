import { IsBoolean } from 'class-validator';

export class AlterarGoleiroFixoDto {
  @IsBoolean()
  ehGoleiroFixo: boolean;
}
