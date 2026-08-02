import { DataSource, Repository } from 'typeorm';
import { ParticipantePeladaEntity } from '../../banco/entidades/participante-pelada.entity';
import { PeladaEntity } from '../../banco/entidades/pelada.entity';
import { StatusParticipantePelada } from '../../comum/enums/status-participante-pelada.enum';
import { StatusPelada } from '../../comum/enums/status-pelada.enum';
import { ErroRegraPelada } from '../../dominio/erros/erro-regra-pelada';
import { SorteiosService } from './sorteios.service';

function pelada(status: StatusPelada, jogadoresLinhaPorTime = 5) {
  return {
    id: 'pelada-1',
    organizadorId: 'usuario-1',
    status,
    configuracao: { jogadoresLinhaPorTime },
  } as unknown as PeladaEntity;
}

function participante(indice: number, ehGoleiroFixo = false) {
  return {
    id: `participante-${indice}`,
    ordemChegada: indice,
    ehGoleiroFixo,
    status: StatusParticipantePelada.PRESENTE,
  } as unknown as ParticipantePeladaEntity;
}

function montar(dados: {
  pelada: PeladaEntity;
  presentes: ParticipantePeladaEntity[];
}) {
  const peladas = {
    findOne: jest.fn().mockResolvedValue(dados.pelada),
    save: jest.fn().mockResolvedValue(dados.pelada),
  } as unknown as Repository<PeladaEntity>;
  const participantes = {
    find: jest.fn().mockResolvedValue(dados.presentes),
  } as unknown as Repository<ParticipantePeladaEntity>;
  // A transacao nunca chega a rodar nos casos deste arquivo: o sorteio falha
  // antes. Se ela rodar, o teste falha alto em vez de passar por acaso.
  const transaction = jest.fn(() => {
    throw new Error('a transacao nao deveria ter comecado');
  });
  const fonteDados = { transaction } as unknown as DataSource;

  return {
    servico: new SorteiosService(peladas, participantes, fonteDados),
    peladas,
    transaction,
  };
}

describe('SorteiosService', () => {
  it('nao marca a pelada como iniciada quando falta gente', async () => {
    const alvo = pelada(StatusPelada.ABERTA_INSCRICOES);
    const { servico, peladas, transaction } = montar({
      pelada: alvo,
      // Nove de linha para um 5x5, que precisa de dez.
      presentes: Array.from({ length: 9 }, (_, i) => participante(i + 1)),
    });

    await expect(servico.sortear('usuario-1', 'pelada-1')).rejects.toThrow(
      ErroRegraPelada,
    );

    // O ponto do teste: a gravacao do status vive dentro da transacao. Gravar
    // antes deixava a pelada EM_ANDAMENTO sem nenhuma partida, e nesse estado
    // o proprio sorteio inicial ficava inalcancavel — a edicao travava.
    expect(peladas.save).not.toHaveBeenCalled();
    expect(alvo.status).toBe(StatusPelada.ABERTA_INSCRICOES);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('recusa sortear em pelada encerrada', async () => {
    const { servico } = montar({
      pelada: pelada(StatusPelada.FINALIZADA),
      presentes: Array.from({ length: 12 }, (_, i) => participante(i + 1)),
    });

    await expect(servico.sortear('usuario-1', 'pelada-1')).rejects.toThrow(
      /encerrada/i,
    );
  });

  it('goleiro fixo nao conta como jogador de linha', async () => {
    const alvo = pelada(StatusPelada.ABERTA_INSCRICOES);
    const { servico } = montar({
      pelada: alvo,
      // Onze presentes, mas dois no gol: sobram nove de linha para um 5x5.
      presentes: [
        ...Array.from({ length: 9 }, (_, i) => participante(i + 1)),
        participante(10, true),
        participante(11, true),
      ],
    });

    await expect(servico.sortear('usuario-1', 'pelada-1')).rejects.toThrow(
      ErroRegraPelada,
    );
    expect(alvo.status).toBe(StatusPelada.ABERTA_INSCRICOES);
  });
});
