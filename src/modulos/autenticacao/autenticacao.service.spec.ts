import { ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { UsuarioEntity } from '../../banco/entidades/usuario.entity';
import { AutenticacaoService } from './autenticacao.service';

describe('AutenticacaoService', () => {
  let servico: AutenticacaoService;
  const repositorio = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const jwt = { signAsync: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    const modulo = await Test.createTestingModule({
      providers: [
        AutenticacaoService,
        { provide: getRepositoryToken(UsuarioEntity), useValue: repositorio },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();
    servico = modulo.get(AutenticacaoService);
  });

  describe('cadastrar', () => {
    it('recusa e-mail ja utilizado', async () => {
      repositorio.findOne.mockResolvedValue({ id: 'existente' });

      await expect(
        servico.cadastrar({
          nome: 'Lucas',
          email: 'a@b.com',
          senha: 'senhaSegura1',
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(repositorio.save).not.toHaveBeenCalled();
    });

    it('salva a senha criptografada, nunca em texto puro', async () => {
      repositorio.findOne.mockResolvedValue(null);
      repositorio.create.mockImplementation(
        (dados: Partial<UsuarioEntity>) => dados,
      );
      repositorio.save.mockImplementation((dados: UsuarioEntity) =>
        Promise.resolve({ ...dados, id: 'novo-id' }),
      );
      jwt.signAsync.mockResolvedValue('token-fake');

      const resultado = await servico.cadastrar({
        nome: 'Lucas',
        email: 'a@b.com',
        senha: 'senhaSegura1',
      });

      const salvo = repositorio.save.mock.calls[0][0] as UsuarioEntity;
      expect(salvo.senhaHash).not.toBe('senhaSegura1');
      expect(await bcrypt.compare('senhaSegura1', salvo.senhaHash)).toBe(true);
      expect(resultado.usuario).not.toHaveProperty('senhaHash');
      expect(resultado.token).toBe('token-fake');
    });

    it('normaliza o e-mail para minusculas', async () => {
      repositorio.findOne.mockResolvedValue(null);
      repositorio.create.mockImplementation(
        (dados: Partial<UsuarioEntity>) => dados,
      );
      repositorio.save.mockImplementation((dados: UsuarioEntity) =>
        Promise.resolve({ ...dados, id: 'novo-id' }),
      );
      jwt.signAsync.mockResolvedValue('token-fake');

      await servico.cadastrar({
        nome: 'Lucas',
        email: 'A@B.COM',
        senha: 'senhaSegura1',
      });

      expect((repositorio.save.mock.calls[0][0] as UsuarioEntity).email).toBe(
        'a@b.com',
      );
    });
  });
});
