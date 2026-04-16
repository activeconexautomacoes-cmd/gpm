import { useMemo } from "react";
import { differenceInDays, subDays, startOfDay, endOfDay, format } from "date-fns";

export interface DateRange {
  from: Date;
  to: Date;
}

export interface KPIData {
  value: number;
  previous: number;
  delta: number;
}

export interface ProductData {
  name: string;
  ganho: KPIData;
  ticketMedio: KPIData;
  taxaConversao: KPIData;
  wins: number;
  leads: number;
}

export interface FunnelStep {
  name: string;
  count: number;
  rate: number;
}

export interface CloserData {
  id: string;
  name: string;
  leads: number;
  wins: number;
  taxaConversao: number;
  reunioesRealizadas: number;
  reunioesPerdidas: number;
  totalGanho: number;
}

export interface ChannelData {
  name: string;
  leads: number;
  mqls: number;
  sqls: number;
  wins: number;
  desqualificados: number;
}

export interface MeetingsData {
  agendadas: KPIData;
  realizadas: KPIData;
  noShow: KPIData;
  taxaNoShow: KPIData;
  taxaAgendamento: KPIData;
  perdidasPorMotivo: { motivo: string; count: number }[];
}

export interface WonDetail {
  id: string;
  leadName: string;
  value: number;
  mensalidade: number;
  implementacao: number;
  product: string;
  wonAt: string;
}

function getPreviousPeriod(dateRange: DateRange): DateRange {
  const days = differenceInDays(dateRange.to, dateRange.from) + 1;
  return { from: subDays(dateRange.from, days), to: subDays(dateRange.from, 1) };
}

function isInRange(dateStr: string | null, range: DateRange): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d >= startOfDay(range.from) && d <= endOfDay(range.to);
}

function makeKPI(current: number, previous: number): KPIData {
  const delta = previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;
  return { value: current, previous, delta };
}

function getProductName(op: any): string | null {
  const prods = op.opportunity_products;
  if (!prods || prods.length === 0) return null;
  return prods[0]?.products?.name?.trim() || null;
}

function getChannelName(opp: any): string {
  const webhookName = opp.custom_fields?.webhook_name;
  if (webhookName) return webhookName;
  if (opp.source === "sdr_ai") return "SDR IA";
  if (opp.source === "manual") return "Manual";
  if (opp.source === "webhook") return "Webhook";
  return opp.source || "Desconhecido";
}

function computeMetrics(opps: any[], stages: any[], range: DateRange) {
  const stageMap = new Map(stages.map((s: any) => [s.id, s]));
  const disqualifiedStageIds = new Set(stages.filter((s: any) => s.is_disqualified).map((s: any) => s.id));

  function pos(o: any): number {
    return stageMap.get(o.current_stage_id)?.order_position || 0;
  }

  const created = opps.filter(o => isInRange(o.created_at, range));
  const won = opps.filter(o => isInRange(o.won_at, range));

  // === RECEITA ===
  // Total Ganho = soma negotiated_value de todos os ganhos
  const totalGanho = won.reduce((s, o) => s + (Number(o.negotiated_value) || 0), 0);

  // Ganho Mensalidade = soma negotiated_price APENAS de Assessoria (serviço recorrente)
  let ganhoMensalidade = 0;
  let ganhoImplementacao = 0;
  let assessoriaWins = 0;
  won.forEach(o => {
    (o.opportunity_products || []).forEach((p: any) => {
      ganhoImplementacao += Number(p.negotiated_implementation_fee) || 0;
      if (p.products?.name?.trim() === "Assessoria") {
        ganhoMensalidade += Number(p.negotiated_price) || 0;
        assessoriaWins++;
      }
    });
  });

  // TX MRR = ganho mensalidade / número de ganhos de assessoria
  const txMrr = assessoriaWins > 0 ? ganhoMensalidade / assessoriaWins : 0;

  // Ticket Médio = total ganho / número de vendas
  const ticketMedio = won.length > 0 ? totalGanho / won.length : 0;

  // Won details (para drill-down)
  const wonDetails: WonDetail[] = won.map(o => {
    let mens = 0, impl = 0, prod = "";
    (o.opportunity_products || []).forEach((p: any) => {
      mens += Number(p.negotiated_price) || 0;
      impl += Number(p.negotiated_implementation_fee) || 0;
      if (p.products?.name) prod = p.products.name.trim();
    });
    return {
      id: o.id,
      leadName: o.lead_name || "Sem nome",
      value: Number(o.negotiated_value) || 0,
      mensalidade: mens,
      implementacao: impl,
      product: prod,
      wonAt: o.won_at,
    };
  });

  // === FUNIL ===
  // Leads = todas as novas entradas
  const leads = created.length;

  // MQL = leads que atendem ICP → saiu de Novo Lead para Qualificação (pos >= 2), exceto Desqualificado e Fim de Cadência
  const mqls = created.filter(o => {
    if (disqualifiedStageIds.has(o.current_stage_id) || o.disqualified_at) return false;
    const p = pos(o);
    return p >= 2 && p !== 9;
  }).length;

  // SQL = info validada pelo SDR → entrou em Qualificação, mesmo critério que MQL
  // (quando entra no funil de qualificação, vira SQL)
  const sqls = mqls;

  // Agendado = entrou em Sessão Agendada (pos 5), Agendado Automaticamente (pos 3), No Show (pos 4), ou já passou (6-8)
  const agendados = created.filter(o => {
    const p = pos(o);
    return p === 3 || p === 4 || p === 5 || (p >= 6 && p <= 8);
  }).length;

  // Realizado = saiu de agendada para qualquer funil a frente (6+), EXCETO No Show (4)
  const realizados = created.filter(o => {
    const p = pos(o);
    return p >= 6 && p <= 8;
  }).length;

  // Ganhos no período
  const ganhos = won.length;

  // Desqualificados
  const disqualificados = created.filter(o => disqualifiedStageIds.has(o.current_stage_id) || o.disqualified_at).length;

  // Taxa de Conversão Geral = ganhos / realizadas × 100
  const taxaConversao = realizados > 0 ? (ganhos / realizados) * 100 : 0;

  // === REUNIÕES ===
  // Agendadas = saíram de qualificação para sessão agendada ou agendado automaticamente
  const meetAgendadas = agendados;
  // Realizadas = movidas de sessão agendada para negociação, ganho ou perdido
  const meetRealizadas = realizados;
  // No Show = agendadas - realizadas
  const meetNoShow = Math.max(meetAgendadas - meetRealizadas, 0);
  // Tx No Show = no show / agendadas × 100
  const taxaNoShow = meetAgendadas > 0 ? (meetNoShow / meetAgendadas) * 100 : 0;
  // Tx Agendamento = agendados / SQL × 100
  const taxaAgendamento = sqls > 0 ? (meetAgendadas / sqls) * 100 : 0;

  // === CICLO DE VENDAS ===
  const salesCycles: { days: number; name: string; product: string; closer: string }[] = [];
  won.forEach(o => {
    if (!o.created_at || !o.won_at) return;
    const days = Math.round((new Date(o.won_at).getTime() - new Date(o.created_at).getTime()) / (1000 * 60 * 60 * 24));
    salesCycles.push({
      days,
      name: o.lead_name || "Sem nome",
      product: getProductName(o) || "N/A",
      closer: o.assigned_closer_profile?.full_name || "N/A",
    });
  });
  const avgCycleDays = salesCycles.length > 0 ? salesCycles.reduce((s, c) => s + c.days, 0) / salesCycles.length : 0;

  // Ciclo por closer
  const cycleByCloser: Record<string, { total: number; count: number }> = {};
  salesCycles.forEach(c => {
    if (!cycleByCloser[c.closer]) cycleByCloser[c.closer] = { total: 0, count: 0 };
    cycleByCloser[c.closer].total += c.days;
    cycleByCloser[c.closer].count++;
  });

  // Ciclo por produto
  const cycleByProduct: Record<string, { total: number; count: number }> = {};
  salesCycles.forEach(c => {
    if (!cycleByProduct[c.product]) cycleByProduct[c.product] = { total: 0, count: 0 };
    cycleByProduct[c.product].total += c.days;
    cycleByProduct[c.product].count++;
  });

  // === FORECAST ===
  // Pipeline = leads ativos (não ganhos, não perdidos, não desqualificados)
  const pipeline = created.filter(o => !o.won_at && !o.lost_at && !disqualifiedStageIds.has(o.current_stage_id) && pos(o) !== 9);
  const pipelineValue = pipeline.reduce((s, o) => s + (Number(o.negotiated_value || o.estimated_value) || 0), 0);
  const pipelineCount = pipeline.length;
  // Forecast = pipeline value × taxa de conversão
  const forecastValue = realizados > 0 ? pipelineValue * (ganhos / realizados) : 0;

  // Perdidas por motivo
  const lost = created.filter(o => o.lost_at);
  const lostByReason: Record<string, number> = {};
  lost.forEach(o => {
    const reason = o.loss_reason || "Sem motivo";
    lostByReason[reason] = (lostByReason[reason] || 0) + 1;
  });

  // === POR PRODUTO ===
  // Ganho por produto = soma negotiated_value dos ganhos que têm aquele produto
  const productMap: Record<string, { wins: number; ganho: number; mensalidade: number; impl: number }> = {};
  won.forEach(o => {
    (o.opportunity_products || []).forEach((p: any) => {
      const pName = p.products?.name?.trim() || "Outro";
      if (!productMap[pName]) productMap[pName] = { wins: 0, ganho: 0, mensalidade: 0, impl: 0 };
      productMap[pName].wins++;
      productMap[pName].ganho += (Number(p.negotiated_price) || 0) + (Number(p.negotiated_implementation_fee) || 0);
      productMap[pName].mensalidade += Number(p.negotiated_price) || 0;
      productMap[pName].impl += Number(p.negotiated_implementation_fee) || 0;
    });
  });

  // === POR CLOSER ===
  const closerMap: Record<string, { name: string; leads: number; wins: number; ganho: number; realizadas: number; perdidas: number }> = {};
  created.forEach(o => {
    const cid = o.assigned_closer;
    if (!cid) return;
    if (!closerMap[cid]) closerMap[cid] = { name: o.assigned_closer_profile?.full_name || "N/A", leads: 0, wins: 0, ganho: 0, realizadas: 0, perdidas: 0 };
    closerMap[cid].leads++;
    const p = pos(o);
    if (p >= 6 && p <= 8) closerMap[cid].realizadas++;
    if (o.lost_at) closerMap[cid].perdidas++;
  });
  won.forEach(o => {
    const cid = o.assigned_closer;
    if (!cid) return;
    if (!closerMap[cid]) closerMap[cid] = { name: o.assigned_closer_profile?.full_name || "N/A", leads: 0, wins: 0, ganho: 0, realizadas: 0, perdidas: 0 };
    closerMap[cid].wins++;
    closerMap[cid].ganho += Number(o.negotiated_value) || 0;
  });

  // === POR CANAL ===
  const channelMap: Record<string, { leads: number; mqls: number; sqls: number; wins: number; desqualificados: number }> = {};
  created.forEach(o => {
    const ch = getChannelName(o);
    if (!channelMap[ch]) channelMap[ch] = { leads: 0, mqls: 0, sqls: 0, wins: 0, desqualificados: 0 };
    channelMap[ch].leads++;
    const p = pos(o);
    const isDq = disqualifiedStageIds.has(o.current_stage_id) || o.disqualified_at;
    if (!isDq && p >= 2 && p !== 9) { channelMap[ch].mqls++; channelMap[ch].sqls++; }
    if (isDq) channelMap[ch].desqualificados++;
  });
  won.forEach(o => {
    const ch = getChannelName(o);
    if (!channelMap[ch]) channelMap[ch] = { leads: 0, mqls: 0, sqls: 0, wins: 0, desqualificados: 0 };
    channelMap[ch].wins++;
  });

  // === POR SDR ===
  const sdrMap: Record<string, { name: string; leads: number; agendados: number }> = {};
  created.forEach(o => {
    const sid = o.assigned_sdr;
    if (!sid) return;
    if (!sdrMap[sid]) sdrMap[sid] = { name: o.assigned_sdr_profile?.full_name || "N/A", leads: 0, agendados: 0 };
    sdrMap[sid].leads++;
    const p = pos(o);
    if (p === 3 || p === 5 || (p >= 6 && p <= 8)) sdrMap[sid].agendados++;
  });

  // === POR SEGMENTO ===
  const segmentMap: Record<string, { leads: number; wins: number; ganho: number }> = {};
  created.forEach(o => {
    const seg = o.company_segment;
    if (!seg) return;
    if (!segmentMap[seg]) segmentMap[seg] = { leads: 0, wins: 0, ganho: 0 };
    segmentMap[seg].leads++;
  });
  won.forEach(o => {
    const seg = o.company_segment;
    if (!seg) return;
    if (!segmentMap[seg]) segmentMap[seg] = { leads: 0, wins: 0, ganho: 0 };
    segmentMap[seg].wins++;
    segmentMap[seg].ganho += Number(o.negotiated_value) || 0;
  });

  return {
    totalGanho, ganhoMensalidade, ganhoImplementacao, txMrr, ticketMedio, taxaConversao,
    leads, mqls, sqls, agendados, realizados, ganhos, disqualificados,
    meetAgendadas, meetRealizadas, meetNoShow, taxaNoShow, taxaAgendamento,
    lostByReason, productMap, closerMap, channelMap, sdrMap, segmentMap, wonDetails,
    avgCycleDays, cycleByCloser, cycleByProduct, salesCycles,
    pipelineValue, pipelineCount, forecastValue,
  };
}

export function useCommercialDashboardData(
  opportunities: any[],
  stages: any[],
  dateRange: DateRange,
  selectedCloserId: string | null,
) {
  return useMemo(() => {
    const filtered = selectedCloserId && selectedCloserId !== "all"
      ? opportunities.filter(o => o.assigned_closer === selectedCloserId)
      : opportunities;

    const prevRange = getPreviousPeriod(dateRange);
    const curr = computeMetrics(filtered, stages, dateRange);
    const prev = computeMetrics(filtered, stages, prevRange);

    // KPIs
    const kpis = {
      totalGanho: makeKPI(curr.totalGanho, prev.totalGanho),
      ganhoMensalidade: makeKPI(curr.ganhoMensalidade, prev.ganhoMensalidade),
      ganhoImplementacao: makeKPI(curr.ganhoImplementacao, prev.ganhoImplementacao),
      txMrr: makeKPI(curr.txMrr, prev.txMrr),
      ticketMedio: makeKPI(curr.ticketMedio, prev.ticketMedio),
      taxaConversao: makeKPI(curr.taxaConversao, prev.taxaConversao),
    };

    // Funnel
    const funnel: FunnelStep[] = [
      { name: "Leads", count: curr.leads, rate: 100 },
      { name: "MQL", count: curr.mqls, rate: curr.leads > 0 ? (curr.mqls / curr.leads) * 100 : 0 },
      { name: "SQL", count: curr.sqls, rate: curr.mqls > 0 ? (curr.sqls / curr.mqls) * 100 : 0 },
      { name: "Agendado", count: curr.agendados, rate: curr.sqls > 0 ? (curr.agendados / curr.sqls) * 100 : 0 },
      { name: "Realizado", count: curr.realizados, rate: curr.agendados > 0 ? (curr.realizados / curr.agendados) * 100 : 0 },
      { name: "Ganho", count: curr.ganhos, rate: curr.realizados > 0 ? (curr.ganhos / curr.realizados) * 100 : 0 },
    ];

    // Products — conversão = wins / realizadas × 100
    const allProductNames = ["Assessoria", "Plus Academy", "Aplicativo"];
    const products: ProductData[] = allProductNames.map(name => {
      const c = curr.productMap[name] || { wins: 0, ganho: 0, mensalidade: 0, impl: 0 };
      const p = prev.productMap[name] || { wins: 0, ganho: 0, mensalidade: 0, impl: 0 };
      const curConv = curr.realizados > 0 ? (c.wins / curr.realizados) * 100 : 0;
      const prevConv = prev.realizados > 0 ? (p.wins / prev.realizados) * 100 : 0;
      return {
        name,
        ganho: makeKPI(c.ganho, p.ganho),
        ticketMedio: makeKPI(c.wins > 0 ? c.ganho / c.wins : 0, p.wins > 0 ? p.ganho / p.wins : 0),
        taxaConversao: makeKPI(curConv, prevConv),
        wins: c.wins,
        leads: c.wins, // for display
      };
    });

    // Meetings
    const meetings: MeetingsData = {
      agendadas: makeKPI(curr.meetAgendadas, prev.meetAgendadas),
      realizadas: makeKPI(curr.meetRealizadas, prev.meetRealizadas),
      noShow: makeKPI(curr.meetNoShow, prev.meetNoShow),
      taxaNoShow: makeKPI(curr.taxaNoShow, prev.taxaNoShow),
      taxaAgendamento: makeKPI(curr.taxaAgendamento, prev.taxaAgendamento),
      perdidasPorMotivo: Object.entries(curr.lostByReason)
        .map(([motivo, count]) => ({ motivo, count }))
        .sort((a, b) => b.count - a.count),
    };

    // Closers — conversão = wins / realizadas
    const closers: CloserData[] = Object.entries(curr.closerMap)
      .map(([id, d]) => ({
        id,
        name: d.name,
        leads: d.leads,
        wins: d.wins,
        taxaConversao: d.realizadas > 0 ? (d.wins / d.realizadas) * 100 : 0,
        reunioesRealizadas: d.realizadas,
        reunioesPerdidas: d.perdidas,
        totalGanho: d.ganho,
      }))
      .sort((a, b) => b.taxaConversao - a.taxaConversao);

    // Channels
    const channels: ChannelData[] = Object.entries(curr.channelMap)
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.leads - a.leads);

    // SDRs
    const sdrs = Object.entries(curr.sdrMap)
      .map(([id, d]) => ({
        id,
        name: d.name,
        leads: d.leads,
        agendados: d.agendados,
        taxaAgendamento: d.leads > 0 ? (d.agendados / d.leads) * 100 : 0,
      }))
      .sort((a, b) => b.agendados - a.agendados);

    // Segments
    const segments = Object.entries(curr.segmentMap)
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.ganho - a.ganho);

    // Won details for drill-down
    const wonDetails = curr.wonDetails;

    // Sales cycle
    const salesCycle = {
      avgDays: makeKPI(curr.avgCycleDays, prev.avgCycleDays),
      byCloser: Object.entries(curr.cycleByCloser).map(([name, d]) => ({
        name, avgDays: d.count > 0 ? Math.round(d.total / d.count) : 0, count: d.count,
      })).sort((a, b) => a.avgDays - b.avgDays),
      byProduct: Object.entries(curr.cycleByProduct).map(([name, d]) => ({
        name, avgDays: d.count > 0 ? Math.round(d.total / d.count) : 0, count: d.count,
      })).sort((a, b) => a.avgDays - b.avgDays),
    };

    // Forecast
    const forecast = {
      pipelineValue: curr.pipelineValue,
      pipelineCount: curr.pipelineCount,
      forecastValue: curr.forecastValue,
      taxaConversao: curr.taxaConversao,
    };

    return { kpis, funnel, products, meetings, closers, channels, sdrs, segments, wonDetails, salesCycle, forecast };
  }, [opportunities, stages, dateRange, selectedCloserId]);
}
