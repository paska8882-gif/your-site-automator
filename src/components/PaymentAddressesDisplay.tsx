import { useState, useEffect } from "react";
import { Copy, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PaymentAddress {
  network: string;
  address: string;
}

export function PaymentAddressesDisplay() {
  const [addresses, setAddresses] = useState<PaymentAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedNetwork, setCopiedNetwork] = useState<string | null>(null);

  useEffect(() => {
    const fetchAddresses = async () => {
      const { data, error } = await supabase
        .from("payment_addresses")
        .select("network, address")
        .eq("is_active", true)
        .neq("address", "")
        .order("network");

      if (!error) {
        setAddresses(data || []);
      }
      setLoading(false);
    };

    fetchAddresses();
  }, []);

  const handleCopy = async (network: string, address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedNetwork(network);
      toast.success(`Адреса ${network} скопійована`);
      setTimeout(() => setCopiedNetwork(null), 2000);
    } catch {
      toast.error("Не вдалося скопіювати");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-3">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (addresses.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-2">
        Реквізити не налаштовані
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground mb-2">
        💳 Реквізити для оплати:
      </div>
      {addresses.map((addr) => (
        <div
          key={addr.network}
          className="rounded border bg-muted/30 p-2 space-y-1"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">{addr.network}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 gap-1"
              onClick={() => handleCopy(addr.network, addr.address)}
            >
              {copiedNetwork === addr.network ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
          <code className="block text-[10px] bg-background rounded p-1.5 break-all select-all font-mono text-muted-foreground">
            {addr.address}
          </code>
        </div>
      ))}
    </div>
  );
}
