import { UpcomingEmptyIllustration } from './DashKpiIllustrations';

export default function DashUpcomingEmpty() {
  return (
    <div className="dash-empty-illustration">
      <UpcomingEmptyIllustration className="dash-empty-illustration__art" />
      <p>Nenhum agendamento para esta data.</p>
    </div>
  );
}
