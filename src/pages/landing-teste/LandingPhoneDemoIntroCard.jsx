import { Calendar, Check, Lock, Scissors, X } from 'lucide-react';
import SlootiLogo from '../../components/SlootiLogo';
import './landing-phone-demo-intro.css';

const STEPS = [
  { Icon: Scissors, label: 'Escolha o serviço' },
  { Icon: Calendar, label: 'Selecione data e horário' },
  { Icon: Check, label: 'Confirme e pronto!' },
];

export default function LandingPhoneDemoIntroCard({ onStart, onClose }) {
  return (
    <div className="lt-demo-intro" role="presentation">
      <div
        className="lt-demo-intro__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lt-demo-intro-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="lt-demo-intro__close" onClick={onClose} aria-label="Fechar">
          <X size={20} strokeWidth={2} />
        </button>

        <div className="lt-demo-intro__body">
          <div className="lt-demo-intro__logo-wrap" aria-hidden>
            <SlootiLogo size="xl" onDark={false} className="lt-demo-intro__logo" />
          </div>

          <h2 id="lt-demo-intro-title" className="lt-demo-intro__title">
            Faça um agendamento em menos de{' '}
            <span className="lt-demo-intro__highlight">30 segundos</span>
          </h2>

          <p className="lt-demo-intro__subtitle">
            Este é um ambiente de teste para você experimentar como seus clientes agendam.
          </p>

          <ul className="lt-demo-intro__steps">
            {STEPS.map((item) => (
              <li key={item.label} className="lt-demo-intro__step">
                <span className="lt-demo-intro__step-icon" aria-hidden>
                  <item.Icon size={22} strokeWidth={2.25} />
                </span>
                <span>{item.label}</span>
              </li>
            ))}
          </ul>

          <button type="button" className="lt-demo-intro__cta" onClick={onStart}>
            Iniciar agendamento teste
            <span aria-hidden>→</span>
          </button>

          <p className="lt-demo-intro__footer">
            <Lock size={16} strokeWidth={2} aria-hidden />
            Ambiente seguro e apenas para testes
          </p>
        </div>
      </div>
    </div>
  );
}
