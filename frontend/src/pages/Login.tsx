import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { User, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import logoImg from '../assets/desangosse.png';
import api from '../services/api';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import './Login.css';

const loginSchema = z.object({
  username: z
    .string()
    .min(3, 'Usuário deve ter no mínimo 3 caracteres')
    .max(64, 'Usuário muito longo')
    .regex(/^[a-zA-Z0-9_.@-]+$/, 'Usuário contém caracteres inválidos'),
  password: z
    .string()
    .min(1, 'A senha é obrigatória')
    .max(128, 'Senha muito longa'),
});

type LoginFormInputs = z.infer<typeof loginSchema>;

const REMEMBER_KEY = '@app-cavazin:remember-username';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);

  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormInputs>({
    resolver: zodResolver(loginSchema),
  });

  // Load saved username on mount
  useEffect(() => {
    const savedUsername = localStorage.getItem(REMEMBER_KEY);
    if (savedUsername) {
      setValue('username', savedUsername);
      setRemember(true);
    }
  }, [setValue]);

  const onSubmit = async (data: LoginFormInputs) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/login', {
        username: data.username.trim(),
        password: data.password,
      });
      const { access_token, user } = response.data;
      login(access_token, user, remember);

      // Save or clear remembered username
      if (remember) {
        localStorage.setItem(REMEMBER_KEY, data.username.trim());
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }

      toast.success(`Bem-vindo, ${user.fullName || user.username}!`);
      navigate('/dashboard');
    } catch {
      toast.error('Credenciais inválidas.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-root">
      <div className="card login-card animate-fade-in">
        <div className="login-logo-wrapper">
          <img src={logoImg} alt="DE SANGOSSE by DSG Logo" className="login-logo-img" />
        </div>

        <div className="login-header">
          <h1>DE SANGOSSE</h1>
          <p>by DSG</p>
        </div>

        <form
          className="login-form"
          onSubmit={(e) => { e.preventDefault(); handleSubmit(onSubmit)(e); }}
          noValidate
        >
          <div className="input-group">
            <label htmlFor="username">Usuário</label>
            <div className="input-with-icon">
              <span className="input-icon">
                <User size={16} />
              </span>
              <input
                id="username"
                type="text"
                placeholder="Seu nome de usuário"
                className={errors.username ? 'error' : ''}
                autoComplete="username"
                spellCheck={false}
                {...register('username')}
              />
            </div>
            {errors.username && (
              <span className="error-msg">{errors.username.message}</span>
            )}
          </div>

          <div className="input-group">
            <label htmlFor="password">Senha</label>
            <div className="input-with-icon input-with-icon-right">
              <span className="input-icon">
                <Lock size={16} />
              </span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Sua senha"
                className={errors.password ? 'error' : ''}
                autoComplete="current-password"
                {...register('password')}
              />
              <button
                type="button"
                className="input-eye-btn"
                onClick={() => setShowPassword(v => !v)}
                tabIndex={-1}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && (
              <span className="error-msg">{errors.password.message}</span>
            )}
          </div>

          {/* Remember me */}
          <label className="login-remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={e => setRemember(e.target.checked)}
            />
            <span>Lembrar meu usuário neste dispositivo</span>
          </label>

          <button
            type="submit"
            className="btn btn-primary login-submit-btn"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner" />
                Entrando...
              </>
            ) : (
              <>
                Entrar
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="login-footer">
          Sistema DE SANGOSSE by DSG · Acesso Restrito
        </div>
      </div>
    </div>
  );
}

