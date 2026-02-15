import React, { useMemo } from 'react';
import { useAppData } from '../context/DataContext';
import MetricCard from '../components/MetricCard';

const Analytics: React.FC = () => {
  const { workItems, timelinePlans, slaPolicies } = useAppData();

  const totalItems = workItems.length;
  const delivered = workItems.filter((item) => item.status === 'Delivered' || item.status === 'Closed').length;
  const slaCompliance = useMemo(() => {
    const total = workItems.filter((item) => item.status !== 'New');
    const withinSla = total.filter((item) => item.slaState === 'WithinSLA');
    return total.length ? Math.round((withinSla.length / total.length) * 100) : 0;
  }, [workItems]);

  const breaches = useMemo(
    () => workItems.filter((item) => item.slaState === 'Breached').length,
    [workItems],
  );

  const priorityDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    workItems.forEach((item) => {
      dist[item.priority] = (dist[item.priority] ?? 0) + 1;
    });
    return Object.entries(dist);
  }, [workItems]);

  const slaByType = useMemo(() => {
    const stats: Record<string, { within: number; total: number }> = {};
    workItems.forEach((item) => {
      if (!stats[item.workItemType]) {
        stats[item.workItemType] = { within: 0, total: 0 };
      }
      stats[item.workItemType].total += 1;
      if (item.slaState === 'WithinSLA') stats[item.workItemType].within += 1;
    });
    return Object.entries(stats).map(([type, counts]) => ({
      type,
      percentage: counts.total ? Math.round((counts.within / counts.total) * 100) : 0,
    }));
  }, [workItems]);

  const weeklyDeliveries = useMemo(
    () =>
      workItems.filter((item) => {
        if (!item.actualEnd) return false;
        const diff = new Date().getTime() - new Date(item.actualEnd).getTime();
        return diff <= 7 * 24 * 60 * 60 * 1000;
      }).length,
    [workItems],
  );

  return (
    <div className="space-y-6">
      <header className="space-y-3 max-w-3xl">
        <p className="text-sm font-semibold text-indigo-600 uppercase tracking-wider">Analytics</p>
        <h1 className="text-3xl font-semibold text-slate-900">Delivery & SLA insights</h1>
        <p className="text-sm text-slate-500">
          Weekly/monthly reporting, SLA compliance, and priority distribution for visibility and planning.
        </p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total work items" value={totalItems} />
        <MetricCard title="Delivered items" value={delivered} bgColorClass="bg-emerald-50" />
        <MetricCard title="SLA compliance" value={slaCompliance} bgColorClass="bg-sky-50" />
        <MetricCard title="SLA breaches" value={breaches} bgColorClass="bg-rose-50" />
      </section>

      <section className="bg-white rounded-2xl border border-slate-100 shadow p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400">Reports</p>
            <h2 className="text-xl font-semibold text-slate-900">Weekly & monthly deliveries</h2>
          </div>
          <button className="!text-xs !text-indigo-600 !font-semibold">Export Excel</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="rounded-2xl border border-slate-100 p-4 bg-slate-50">
            <p className="text-xs uppercase text-slate-400">Weekly delivered</p>
            <p className="text-2xl font-semibold text-slate-900">{weeklyDeliveries}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 p-4 bg-white">
            <p className="text-xs uppercase text-slate-400">Monthly deliveries</p>
            <p className="text-2xl font-semibold text-slate-900">{delivered}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 p-4 bg-white">
            <p className="text-xs uppercase text-slate-400">Timeline plans</p>
            <p className="text-2xl font-semibold text-slate-900">{timelinePlans.length}</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[1fr,320px] gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow p-6 space-y-3">
          <h3 className="text-lg font-semibold text-slate-900">Priority distribution</h3>
          <div className="space-y-2 text-sm">
            {priorityDistribution.map(([priority, count]) => (
              <div key={priority} className="flex items-center justify-between">
                <span className="text-slate-600">{priority}</span>
                <span className="font-semibold text-slate-900">{count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow p-6 space-y-3">
          <h3 className="text-lg font-semibold text-slate-900">SLA compliance by type</h3>
          <div className="space-y-3 text-sm">
            {slaByType.map((row) => (
              <div key={row.type}>
                <div className="flex items-center justify-between mb-1">
                  <span className="uppercase text-xs tracking-wider text-slate-400">{row.type}</span>
                  <span className="text-sm font-semibold text-slate-900">{row.percentage}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${row.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-100 shadow p-6">
        <h3 className="text-lg font-semibold text-slate-900">SLA policy overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-sm">
          {slaPolicies.map((policy) => (
            <div key={policy.id} className="border border-slate-100 rounded-2xl p-4 bg-slate-50">
              <p className="text-sm font-semibold text-slate-900">{policy.name}</p>
              <p className="text-xs text-slate-500">{policy.appliesTo.join(', ')}</p>
              <div className="mt-3 space-y-1 text-slate-600">
                {Object.entries(policy.stageDurations).map(([stage, hours]) => (
                  <p key={stage}>
                    {stage}: {hours}h
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Analytics;

