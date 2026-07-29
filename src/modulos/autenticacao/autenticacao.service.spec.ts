import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { UsuarioEntity } from '../../banco/entidades/usuario.entity';
import { PerfilUsuario } from '../../comum/enums/perfil-usuario.enum';
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

  describe('entrar', () => {
    function prepararBusca(usuario: Partial<UsuarioEntity> | null) {
      repositorio.createQueryBuilder.mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(usuario),
      });
    }

    it('recusa credencial com e-mail inexistente', async () => {
      prepararBusca(null);

      await expect(
        servico.entrar({ email: 'a@b.com', senha: 'senhaSegura1' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('recusa senha incorreta', async () => {
      prepararBusca({
        id: '1',
        email: 'a@b.com',
        ativo: true,
        senhaHash: await bcrypt.hash('outraSenha1', 10),
      });

      await expect(
        servico.entrar({ email: 'a@b.com', senha: 'senhaSegura1' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('recusa usuario inativo mesmo com senha correta', async () => {
      prepararBusca({
        id: '1',
        email: 'a@b.com',
        ativo: false,
        senhaHash: await bcrypt.hash('senhaSegura1', 10),
      });

      await expect(
        servico.entrar({ email: 'a@b.com', senha: 'senhaSegura1' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('devolve token e usuario sem o hash quando a credencial esta correta', async () => {
      prepararBusca({
        id: '1',
        nome: 'Lucas',
        email: 'a@b.com',
        perfil: PerfilUsuario.ORGANIZADOR,
        ativo: true,
        senhaHash: await bcrypt.hash('senhaSegura1', 10),
      });
      jwt.signAsync.mockResolvedValue('token-fake');

      const resultado = await servico.entrar({
        email: 'a@b.com',
        senha: 'senhaSegura1',
      });

      expect(resultado.token).toBe('token-fake');
      expect(resultado.usuario).not.toHaveProperty('senhaHash');
      expect(jwt.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: '1',
          perfil: PerfilUsuario.ORGANIZADOR,
        }),
      );
    });
  });
});
