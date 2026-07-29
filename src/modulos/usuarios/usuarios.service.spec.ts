import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsuarioEntity } from '../../banco/entidades/usuario.entity';
import { PerfilUsuario } from '../../comum/enums/perfil-usuario.enum';
import { ErroRegraPelada } from '../../dominio/erros/erro-regra-pelada';
import { UsuariosService } from './usuarios.service';

const ADMIN = 'admin-1';

describe('UsuariosService', () => {
  let servico: UsuariosService;
  const repositorio = {
    findOne: jest.fn(),
    save: jest.fn(),
    softRemove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const modulo = await Test.createTestingModule({
      providers: [
        UsuariosService,
        { provide: getRepositoryToken(UsuarioEntity), useValue: repositorio },
      ],
    }).compile();
    servico = modulo.get(UsuariosService);
  });

  it('devolve 404 para usuario inexistente', async () => {
    repositorio.findOne.mockResolvedValue(null);

    await expect(servico.buscarPorId('nao-existe')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('impede o administrador de rebaixar a si mesmo', async () => {
    repositorio.findOne.mockResolvedValue({
      id: ADMIN,
      perfil: PerfilUsuario.ADMINISTRADOR,
    });

    await expect(
      servico.atualizar(ADMIN, ADMIN, { perfil: PerfilUsuario.ORGANIZADOR }),
    ).rejects.toBeInstanceOf(ErroRegraPelada);
  });

  it('impede o administrador de desativar a propria conta', async () => {
    repositorio.findOne.mockResolvedValue({
      id: ADMIN,
      perfil: PerfilUsuario.ADMINISTRADOR,
    });

    await expect(
      servico.atualizar(ADMIN, ADMIN, { ativo: false }),
    ).rejects.toBeInstanceOf(ErroRegraPelada);
  });

  it('impede o administrador de remover a propria conta', async () => {
    repositorio.findOne.mockResolvedValue({ id: ADMIN });

    await expect(servico.remover(ADMIN, ADMIN)).rejects.toBeInstanceOf(
      ErroRegraPelada,
    );
    expect(repositorio.softRemove).not.toHaveBeenCalled();
  });

  it('promove outro usuario a administrador', async () => {
    const alvo = {
      id: 'outro',
      perfil: PerfilUsuario.ORGANIZADOR,
    } as UsuarioEntity;
    repositorio.findOne.mockResolvedValue(alvo);
    repositorio.save.mockImplementation((d: UsuarioEntity) =>
      Promise.resolve(d),
    );

    const atualizado = await servico.atualizar(ADMIN, 'outro', {
      perfil: PerfilUsuario.ADMINISTRADOR,
    });

    expect(atualizado.perfil).toBe(PerfilUsuario.ADMINISTRADOR);
  });

  it('lista paginado aplicando o filtro de busca', async () => {
    const construtor = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'u1' }], 1]),
    };
    repositorio.createQueryBuilder.mockReturnValue(construtor);

    const resultado = await servico.listar({
      busca: 'luc',
      pagina: 1,
      limite: 20,
      pular: 0,
    });

    expect(construtor.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('ILIKE'),
      expect.objectContaining({ busca: '%luc%' }),
    );
    expect(resultado.paginacao.total).toBe(1);
  });
});
