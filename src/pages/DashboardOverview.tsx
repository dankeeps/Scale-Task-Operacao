import { useState, useEffect, useMemo } from "react";
import { useProjectContext } from "@/contexts/ProjectContext";
import { useCurrentUserRole } from "@/hooks/useCurrentUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Palette, CheckSquare, Minus, 
  Activity, BarChart3, Eye, Zap, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { subDays } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUS_LABELS: Record<string, string> = {
  enviado_gravacao: "Gravação",
  enviado_analise_1: "Análise 1",
  enviado_edicao: "Edição",
  enviado_analise_2: "Análise 2",
  enviado_subir: "Subir",
  no_ar: "No Ar",
};

const STATUS_COLORS: Record<string, string> = {
  enviado_gravacao: "from-white/[0.07] to-white/[0.03]",
  enviado_analise_1: "from-white/[0.07] to-white/[0.03]",
  enviado_edicao: "from-white/[0.07] to-white/[0.03]",
  enviado_analise_2: "from-white/[0.07] to-white/[0.03]",
  enviado_subir: "from-white/[0.07] to-white/[0.03]",
  no_ar: "from-white/[0.10] to-white/[0.04]",
};

const STATUS_TEXT: Record<string, string> = {
  enviado_gravacao: "text-foreground",
  enviado_analise_1: "text-foreground",
  enviado_edicao: "text-foreground",
  enviado_analise_2: "text-foreground",
  enviado_subir: "text-foreground",
  no_ar: "text-foreground",
};

interface MetricComparison {
  label: string;
  prev: number | null;
  curr: number | null;
  suffix?: string;
  invert?: boolean; // lower is better (CPA, CPC)
}

function DiffBadge({ prev, curr, invert }: { prev: number | null; curr: number | null; invert?: boolean }) {
  if (prev == null || curr == null || prev === 0) return <span className="text-[10px] text-muted-foreground">—</span>;
  const diff = ((curr - prev) / prev) * 100;
  const isPositive = invert ? diff < 0 : diff > 0;
  const isNeutral = Math.abs(diff) < 0.5;

  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-[10px] font-medium",
      isNeutral ? "text-muted-foreground" : isPositive ? "text-emerald-400" : "text-red-400"
    )}>
      {isNeutral ? <Minus className="h-2.5 w-2.5" /> : isPositive ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
      {Math.abs(diff).toFixed(1)}%
    </span>
  );
}

function formatNum(v: number | null, suffix?: string) {
  if (v == null) return "—";
  if (suffix === "%") return `${v.toFixed(1)}%`;
  if (suffix === "R$") return `R$ ${v.toFixed(2)}`;
  return v.toFixed(2);
}

const DashboardOverview = () => {
  const { currentProject, projects } = useProjectContext();
  const { canViewMetrics } = useCurrentUserRole();
  const projectId = currentProject?.id;
  const allProjectIds = useMemo(() => projects.map(p => p.id), [projects]);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [adsByStatus, setAdsByStatus] = useState<Record<string, number>>({});
  const [validatedCount, setValidatedCount] = useState(0);
  const [validatedDays, setValidatedDays] = useState(15);
  const [totalTasks, setTotalTasks] = useState(0);
  const [myTasks, setMyTasks] = useState(0);
  const [trafficComparisons, setTrafficComparisons] = useState<MetricComparison[]>([]);
  const [vslComparisons, setVslComparisons] = useState<MetricComparison[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  // Fetch creative stats
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const { data: ads } = await supabase
        .from("creative_ads")
        .select("status, validacao, created_at")
        .eq("project_id", projectId);

      if (!ads) return;

      const counts: Record<string, number> = {};
      Object.keys(STATUS_LABELS).forEach(k => counts[k] = 0);
      ads.forEach(a => { counts[a.status] = (counts[a.status] || 0) + 1; });
      setAdsByStatus(counts);

      const cutoff = subDays(new Date(), validatedDays).toISOString();
      const validated = ads.filter(a => a.validacao && a.created_at >= cutoff).length;
      setValidatedCount(validated);
    })();
  }, [projectId, validatedDays]);

  // Fetch task counts
  useEffect(() => {
    if (!allProjectIds.length || !currentUserId) return;
    (async () => {
      const { count: total } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .in("project_id", allProjectIds)
        .neq("status", "arquivada");

      const { count: mine } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .in("project_id", allProjectIds)
        .eq("assigned_to", currentUserId)
        .neq("status", "arquivada");

      setTotalTasks(total || 0);
      setMyTasks(mine || 0);
    })();
  }, [allProjectIds, currentUserId]);

  // Fetch metrics comparison
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const { data: metrics } = await supabase
        .from("metrics")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(2);

      if (!metrics || metrics.length < 2) {
        setTrafficComparisons([]);
        setVslComparisons([]);
        return;
      }

      const [curr, prev] = metrics;

      setTrafficComparisons([
        { label: "Investimento", prev: prev.investimento, curr: curr.investimento, suffix: "R$" },
        { label: "Faturamento", prev: prev.faturamento, curr: curr.faturamento, suffix: "R$" },
        { label: "ROAS", prev: prev.roas, curr: curr.roas },
        { label: "CPA", prev: prev.cpa, curr: curr.cpa, suffix: "R$", invert: true },
        { label: "CPM", prev: prev.cpm, curr: curr.cpm, suffix: "R$", invert: true },
        { label: "CPC", prev: prev.cpc, curr: curr.cpc, suffix: "R$", invert: true },
        { label: "Custo/IC", prev: prev.custo_por_ic, curr: curr.custo_por_ic, suffix: "R$", invert: true },
      ]);

      setVslComparisons([
        { label: "Hook Rate", prev: prev.hook_rate, curr: curr.hook_rate, suffix: "%" },
        { label: "Hold Rate", prev: prev.hold_rate, curr: curr.hold_rate, suffix: "%" },
        { label: "Play Rate", prev: prev.play_rate, curr: curr.play_rate, suffix: "%" },
        { label: "Ret. 1 min", prev: prev.retencao_primeiro_minuto, curr: curr.retencao_primeiro_minuto, suffix: "%" },
        { label: "Ret. Pitch", prev: prev.retencao_pitch, curr: curr.retencao_pitch, suffix: "%" },
        { label: "Conv. Vturb", prev: prev.conversao_vturb, curr: curr.conversao_vturb, suffix: "%" },
        { label: "Conv. PV", prev: prev.conversao_pv, curr: curr.conversao_pv, suffix: "%" },
        { label: "Conv. Checkout", prev: prev.conv_checkout, curr: curr.conv_checkout, suffix: "%" },
      ]);
    })();
  }, [projectId]);


  const totalCreatives = Object.values(adsByStatus).reduce((s, v) => s + v, 0);

  return (
    <div className="dash-neutral animate-fade-in h-full overflow-y-auto pr-1 space-y-4 sm:space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-sm font-semibold text-foreground">Dashboard</h1>
        <p className="text-2xs text-muted-foreground mt-0.5">Visão geral do projeto {currentProject?.name}</p>
      </div>

      {/* Creative Status Bar */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Palette className="h-3.5 w-3.5 text-primary" />
          <span className="text-2xs font-medium text-foreground">Status dos Criativos</span>
          <span className="text-[10px] text-muted-foreground">({totalCreatives} total)</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <Card key={key} className="surface border-0 shadow-none p-2.5 sm:p-3 text-center relative overflow-hidden">
              <p className={cn("text-lg sm:text-xl font-bold", STATUS_TEXT[key])}>{adsByStatus[key] || 0}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Validated Creatives */}
        <Card className="surface border-0 shadow-none p-3 sm:p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-primary/10 to-transparent rounded-bl-full" />
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Eye className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-[10px] text-muted-foreground">Validados</span>
              </div>
              <Select value={String(validatedDays)} onValueChange={(v) => setValidatedDays(Number(v))}>
                <SelectTrigger className="h-6 w-[100px] text-[10px] border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 dias</SelectItem>
                  <SelectItem value="15">15 dias</SelectItem>
                  <SelectItem value="30">30 dias</SelectItem>
                  <SelectItem value="60">60 dias</SelectItem>
                  <SelectItem value="90">90 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-foreground">{validatedCount}</p>
            <p className="text-[10px] text-muted-foreground mt-1">criativos aprovados</p>
          </div>
        </Card>

        {/* Total Tasks */}
        <Card className="surface border-0 shadow-none p-3 sm:p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-500/10 to-transparent rounded-bl-full" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-7 w-7 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <CheckSquare className="h-3.5 w-3.5 text-blue-400" />
              </div>
              <span className="text-[10px] text-muted-foreground">Tarefas gerais</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-foreground">{totalTasks}</p>
            <p className="text-[10px] text-muted-foreground mt-1">tarefas ativas</p>
          </div>
        </Card>

        {/* My Tasks */}
        <Card className="surface border-0 shadow-none p-3 sm:p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-emerald-500/10 to-transparent rounded-bl-full" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-7 w-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Zap className="h-3.5 w-3.5 text-emerald-400" />
              </div>
              <span className="text-[10px] text-muted-foreground">Minhas tarefas</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-foreground">{myTasks}</p>
            <p className="text-[10px] text-muted-foreground mt-1">atribuídas a você</p>
          </div>
        </Card>
      </div>

    </div>
  );
};

export default DashboardOverview;
