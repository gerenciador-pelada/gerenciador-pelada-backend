import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class AdicionarParticipanteDto {
  @IsUUID('4') jogadorId: string;
  @IsOptional() @IsBoolean() ehGoleiroFixo?: boolean;
}
