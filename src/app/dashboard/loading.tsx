import '@/styles/dashboard.css';

export default function DashboardLoading() {
  return (
    <div className="page dashboard" aria-busy="true">
      <div className="dash-head">
        <div>
          <h1>האזור האישי</h1>
          <p className="muted" role="status">
            טוען את הנתונים שלך…
          </p>
        </div>
      </div>
      <div className="kpi-strip" aria-hidden>
        <div className="kpi dash-skel" />
        <div className="kpi dash-skel" />
        <div className="kpi dash-skel" />
      </div>
      <div className="grid-cards" aria-hidden>
        <div className="dash-skel dash-skel-card" />
        <div className="dash-skel dash-skel-card" />
      </div>
    </div>
  );
}
