import { HistoricoService } from './historico.service';
describe('HistoricoService', () => {
  it('marca a ultima acao como desfeita', async () => {
    const repositorio = {
      findOne: jest
        .fn()
        .mockResolvedValue({ snapshotEstado: { fila: [] }, desfeitaEm: null }),
      save: jest.fn(),
    };
    const servico = new HistoricoService(repositorio as never);
    await expect(servico.desfazer('p')).resolves.toEqual({ fila: [] });
    expect(repositorio.save).toHaveBeenCalled();
  });
});
