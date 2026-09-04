import { useState } from "react";
import { Plus } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CatalogItem } from "@/hooks/useSwipeCatalogs";

interface Props {
  label: string;
  placeholder?: string;
  items: CatalogItem[];
  value: string | null;
  onChange: (id: string | null) => void;
  onAdd: (name: string) => Promise<CatalogItem | null>;
  disabled?: boolean;
  required?: boolean;
}

export function CatalogSelect({ label, placeholder, items, value, onChange, onAdd, disabled, required }: Props) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const commit = async () => {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    const item = await onAdd(name);
    setSaving(false);
    if (item) onChange(item.id);
    setNewName("");
    setAdding(false);
  };

  return (
    <div className="space-y-1">
      <Label className="text-2xs">{label}{required && <span className="text-destructive"> *</span>}</Label>
      {adding ? (
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={`Novo(a) ${label.toLowerCase()}`}
            className="h-8 text-2xs bg-secondary/30 border-border/50 flex-1"
            autoFocus
            disabled={saving}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commit(); }
              if (e.key === "Escape") { setAdding(false); setNewName(""); }
            }}
          />
          <Button type="button" size="sm" variant="outline" className="h-8 text-2xs px-2" disabled={saving || !newName.trim()} onClick={commit}>
            OK
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-8 text-2xs px-2" disabled={saving} onClick={() => { setAdding(false); setNewName(""); }}>
            ✕
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Select value={value ?? undefined} onValueChange={onChange} disabled={disabled}>
            <SelectTrigger className="h-8 text-2xs bg-secondary/30 border-border/50 flex-1">
              <SelectValue placeholder={placeholder ?? `Selecionar ${label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {items.length === 0 ? (
                <div className="px-2 py-1.5 text-2xs text-muted-foreground">Nenhum cadastrado</div>
              ) : (
                items.map((it) => (
                  <SelectItem key={it.id} value={it.id} className="text-2xs">
                    {it.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-8 w-8 shrink-0 border-border/50"
            disabled={disabled}
            onClick={() => setAdding(true)}
            title={`Adicionar ${label.toLowerCase()}`}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
