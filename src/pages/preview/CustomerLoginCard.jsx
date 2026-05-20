import LoginFormCard from '../../components/auth/LoginFormCard';

export default function CustomerLoginCard(props) {
  return (
    <LoginFormCard
      {...props}
      showGoogle
      showRegister
      showForgot
    />
  );
}
