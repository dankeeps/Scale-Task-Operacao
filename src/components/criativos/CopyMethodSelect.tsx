import { useState } from "react";
import { Plus, Check, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CopyMethod } from "@/hooks/useCopyMethods";

interface Props {
  items: CopyMethod[];
  value: string;
  onChange: (id: string) => void;
  onAdd: (name: string) => Promise<CopyMethod | null>;
}

// Select de "Método de Copy" com "+ adicionar" inline — espelha AvatarSelect.
export function CopyMethodSelect({ items, value, onChange, onAdd }: Props) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const commit = async () => {
    const v = name.trim();
    if (!v) return;
    setSaving(true);
    const item = await onAdd(v);
    setSaving(false);
    if (item) onChange(item.id);
    setName("");
    setAdding(false);
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Método de Copy</Label>
      {adding ? (
        <div className="flex gap-1.5">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Novo método de copy"
            disabled={saving}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commit(); }
              if (e.key === "Escape") { setAdding(false); setName(""); }
            }}
          />
          <Button type="button" size="icon" variant="outline" className="shrink-0" disabled={saving || !name.trim()} onClick={commit}>
            <Check className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" variant="ghost" className="shrink-0" disabled={saving} onClick={() => { setAdding(false); setName(""); }}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex gap-1.5">
          <Select value={value || undefined} onValueChange={onChange}>
            <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {items.length === 0 ? (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum cadastrado</div>
              ) : (
                items.map((it) => (
                  <SelectItem key={it.id} value={it.id}>{it.name}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button type="button" size="icon" variant="outline" className="shrink-0" onClick={() => setAdding(true)} title="Cadastrar método de copy">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
