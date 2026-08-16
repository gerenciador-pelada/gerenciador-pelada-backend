import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
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
    softRemove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const jwt = { signAsync: jest.fn() };

  // O cadastro so abre com este codigo. Os testes de cadastro que nao estao
  // testando o portao precisam passar por ele primeiro.
  const CONVITE = 'convite-de-teste';

  beforeEach(async () => {
    jest.resetAllMocks();
    process.env.CADASTRO_CONVITE = CONVITE;
    const modulo = await Test.createTestingModule({
      providers: [
        AutenticacaoService,
        { provide: getRepositoryToken(UsuarioEntity), useValue: repositorio },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();
    servico = modulo.get(AutenticacaoService);
  });

  // O cadastro cria um ORGANIZADOR. Se o portao cair, qualquer pessoa que
  // alcance o endereco vira organizador — por isso ele tem teste proprio.
  describe('cadastrar: portao de convite', () => {
    const dados = {
      nome: 'Lucas',
      email: 'a@b.com',
      senha: 'senhaSegura1',
    };

    it('recusa quando nao ha convite configurado — fechado por padrao', async () => {
      delete process.env.CADASTRO_CONVITE;

      await expect(
        servico.cadastrar({ ...dados, convite: 'qualquer-coisa' }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(repositorio.save).not.toHaveBeenCalled();
    });

    it('recusa convite ausente', async () => {
      await expect(servico.cadastrar(dados)).rejects.toBeInstanceOf(
        ForbiddenException,
      );

      expect(repositorio.save).not.toHaveBeenCalled();
    });

    it('recusa convite errado', async () => {
      await expect(
        servico.cadastrar({ ...dados, convite: 'chute' }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(repositorio.save).not.toHaveBeenCalled();
    });

    it('recusa convite que so acerta o prefixo', async () => {
      await expect(
        servico.cadastrar({ ...dados, convite: CONVITE.slice(0, -1) }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(repositorio.save).not.toHaveBeenCalled();
    });

    it('recusa antes de tocar o banco — nao serve para descobrir e-mails', async () => {
      await expect(
        servico.cadastrar({ ...dados, convite: 'chute' }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(repositorio.findOne).not.toHaveBeenCalled();
    });
  });

  describe('cadastrar', () => {
    it('recusa e-mail ja utilizado', async () => {
      repositorio.findOne.mockResolvedValue({ id: 'existente' });

      await expect(
        servico.cadastrar({
          nome: 'Lucas',
          email: 'a@b.com',
          senha: 'senhaSegura1',
          convite: CONVITE,
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
        convite: CONVITE,
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
        convite: CONVITE,
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

  // A App Store recusa app que cria conta e nao deixa apaga-la. Se este
  // comportamento regredir, a publicacao volta a ser barrada — e, pior, alguem
  // que pediu exclusao continua no banco com nome e e-mail.
  describe('excluirPropriaConta', () => {
    const contaSalva = () => repositorio.save.mock.calls[0][0] as UsuarioEntity;

    function prepararConta(): Partial<UsuarioEntity> {
      const usuario = {
        id: 'usuario-1',
        nome: 'Lucas',
        email: 'lucas@exemplo.com',
        senhaHash: 'hash-real',
        perfil: PerfilUsuario.ORGANIZADOR,
        ativo: true,
      };
      repositorio.findOne.mockResolvedValue(usuario);
      repositorio.save.mockImplementation((dados: UsuarioEntity) =>
        Promise.resolve(dados),
      );
      return usuario;
    }

    it('apaga nome, e-mail e senha do banco', async () => {
      prepararConta();

      await servico.excluirPropriaConta('usuario-1');

      const salva = contaSalva();
      expect(salva.nome).not.toBe('Lucas');
      expect(salva.email).not.toBe('lucas@exemplo.com');
      expect(salva.senhaHash).not.toBe('hash-real');
    });

    it('remove a conta logicamente e a desativa — as duas portas do login', async () => {
      prepararConta();

      await servico.excluirPropriaConta('usuario-1');

      expect(contaSalva().ativo).toBe(false);
      expect(repositorio.softRemove).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'usuario-1' }),
      );
    });

    // O indice de e-mail e unico e nao e parcial: se o endereco real ficasse
    // gravado, a pessoa nunca mais conseguiria se cadastrar com ele.
    it('libera o e-mail para um novo cadastro', async () => {
      prepararConta();

      await servico.excluirPropriaConta('usuario-1');

      expect(contaSalva().email).toContain('usuario-1');
      expect(contaSalva().email).not.toContain('lucas@exemplo.com');
    });

    it('recusa token de conta que ja nao existe', async () => {
      repositorio.findOne.mockResolvedValue(null);

      await expect(servico.excluirPropriaConta('sumiu')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      expect(repositorio.save).not.toHaveBeenCalled();
      expect(repositorio.softRemove).not.toHaveBeenCalled();
    });
  });
});
