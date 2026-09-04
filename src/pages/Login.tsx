import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Zap } from "lucide-react";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      toast({ title: "Erro ao entrar", description: error.message, variant: "destructive" });
    } else {
      // Honor a shared deep link (?redirect=...) so login returns to that swipe.
      // Only accept in-app paths (start with a single "/") to avoid open redirects.
      const rp = searchParams.get("redirect");
      const redirect = rp && rp.startsWith("/") && !rp.startsWith("//") ? rp : null;
      navigate(redirect || (isMobile ? "/dashboard/hoje" : "/dashboard"), { replace: true });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent p-4">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="glass w-full max-w-sm rounded-2xl p-8 animate-fade-in">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center gap-2">
            <Zap className="h-5 w-5 icon-neon" />
            <span className="text-lg font-semibold tracking-tight text-foreground">ScaleTask</span>
          </div>
          <p className="text-xs text-muted-foreground">Entre na sua conta</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs text-muted-foreground">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="h-9 bg-secondary/50 border-border text-sm placeholder:text-muted-foreground/50"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs text-muted-foreground">Senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="h-9 bg-secondary/50 border-border text-sm placeholder:text-muted-foreground/50"
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full h-9 text-xs font-medium glow-primary">
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <p className="mt-6 text-center text-2xs text-muted-foreground">
          Não tem uma conta?{" "}
          <Link to="/signup" className="text-primary hover:underline">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
