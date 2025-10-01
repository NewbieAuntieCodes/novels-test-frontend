import React, { useState } from 'react';
import styled from '@emotion/styled';
import { COLORS, SPACING, FONTS, SHADOWS, BORDERS } from '../../styles';

interface LoginPageProps {
  onLogin: (username: string, password: string) => void;
  onNavigateToRegister: () => void;
}

const AuthPage = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: ${COLORS.gray100};
  padding: ${SPACING.xl};
  box-sizing: border-box;
`;

const AuthFormContainer = styled.div`
  background-color: ${COLORS.white};
  padding: ${SPACING.xxl} ${parseInt(SPACING.xxl, 10) * 1.5}px;
  border-radius: ${SPACING.md};
  box-shadow: ${SHADOWS.medium};
  width: 100%;
  max-width: 420px;
  text-align: center;
`;

const Title = styled.h2`
  margin-bottom: ${SPACING.xl};
  color: ${COLORS.dark};
  font-size: ${FONTS.sizeH2};
`;

const AuthForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${SPACING.lg};
`;

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  text-align: left;
  gap: ${SPACING.xs};
`;

const Label = styled.label`
  font-weight: bold;
  color: ${COLORS.textLight};
  font-size: ${FONTS.sizeSmall};
`;

const AuthInput = styled.input`
  padding: ${SPACING.sm};
  border: ${BORDERS.width} ${BORDERS.style} ${BORDERS.color};
  border-radius: ${BORDERS.radius};
  box-sizing: border-box;
  background-color: ${COLORS.white};
  font-size: ${FONTS.sizeSmall};
  width: 100%;
  
  &:focus {
    border-color: ${COLORS.primary};
    box-shadow: 0 0 0 0.2rem ${COLORS.primary}40;
    outline: none;
  }
`;

const AuthButton = styled.button`
  padding: ${SPACING.md} ${SPACING.lg};
  font-size: ${FONTS.sizeLarge};
  margin-top: ${SPACING.sm};
  background-color: ${COLORS.primary};
  color: ${COLORS.white};
  border: none;
  border-radius: ${BORDERS.radius};
  cursor: pointer;
  transition: background-color 0.2s, box-shadow 0.2s;
  
  &:hover {
    background-color: ${COLORS.primaryHover};
    box-shadow: ${SHADOWS.small};
  }
`;

const AuthSwitchText = styled.p`
  margin-top: ${SPACING.lg};
  font-size: ${FONTS.sizeSmall};
  color: ${COLORS.textLight};
`;

const LinkButton = styled.button`
  background: none;
  border: none;
  color: ${COLORS.primary};
  padding: 0;
  cursor: pointer;
  text-decoration: underline;
  font-size: inherit;

  &:hover {
    color: ${COLORS.primaryHover};
  }
`;

const LoginPage: React.FC<LoginPageProps> = ({ onLogin, onNavigateToRegister }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() && password.trim()) {
      onLogin(username, password);
    } else {
      alert('请输入用户名和密码。');
    }
  };

  return (
    <AuthPage>
      <AuthFormContainer>
        <Title>用户登录</Title>
        <AuthForm onSubmit={handleSubmit}>
          <InputGroup>
            <Label htmlFor="login-username">用户名</Label>
            <AuthInput
              id="login-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="输入您的用户名"
              required
              aria-label="用户名"
            />
          </InputGroup>
          <InputGroup>
            <Label htmlFor="login-password">密码</Label>
            <AuthInput
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="输入您的密码"
              required
              aria-label="密码"
            />
          </InputGroup>
          <AuthButton type="submit">
            登录
          </AuthButton>
        </AuthForm>
        <AuthSwitchText>
          还没有账户？{' '}
          <LinkButton type="button" onClick={onNavigateToRegister}>
            立即注册
          </LinkButton>
        </AuthSwitchText>
      </AuthFormContainer>
    </AuthPage>
  );
};

export default LoginPage;
