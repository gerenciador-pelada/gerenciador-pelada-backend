import { IsEnum } from 'class-validator';
import { StatusParticipantePelada } from '../../../comum/enums/status-participante-pelada.enum';
export class AlterarStatusParticipanteDto {
  @IsEnum(StatusParticipantePelada) status: StatusParticipantePelada;
}
