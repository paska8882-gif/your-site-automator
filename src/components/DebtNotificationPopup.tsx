import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Copy, Check, MessageCircle, Wallet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface DebtNotificationPopupProps {
  open: boolean;
  onClose: () => void;
  teamName: string;
  balance: number;
}

interface PaymentAddress {
  network: string;
  address: string;
}

export function DebtNotificationPopup({
  open,
  onClose,
  teamName,
  balance,
}: DebtNotificationPopupProps) {
  const navigate = useNavigate();
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<PaymentAddress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      fetchAddresses();
    }
  }, [open]);

  const fetchAddresses = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("payment_addresses")
      .select("network, address")
      .eq("is_active", true)
      .neq("address", "")
      .order("network");

    if (error) {
      console.error("Error fetching addresses:", error);
    } else {
      setAddresses(data || []);
    }
    setLoading(false);
  };

  const handleCopy = async (network: string, address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(network);
      toast({
        title: "Скопійовано!",
        description: `Адреса ${network} скопійована в буфер обміну`,
      });
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (err) {
      toast({
        title: "Помилка",
        description: "Не вдалося скопіювати адресу",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Оплатіть баланс
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-destructive/10 p-3 text-sm">
            <p className="font-medium">
              Команда "{teamName}" має заборгованість:{" "}
              <span className="text-destructive font-bold">
                ${Math.abs(balance).toFixed(2)}
              </span>
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              🔥 Реквізити на оплату
            </h4>

            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : addresses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">
                Немає доступних реквізитів
              </p>
            ) : (
              addresses.map((addr) => (
                <div
                  key={addr.network}
                  className="rounded-lg border bg-muted/50 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{addr.network}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 gap-1"
                      onClick={() => handleCopy(addr.network, addr.address)}
                    >
                      {copiedAddress === addr.network ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-green-500" />
                          <span className="text-xs text-green-500">Скопійовано</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span className="text-xs">Копіювати</span>
                        </>
                      )}
                    </Button>
                  </div>
                  <code className="block text-xs bg-background rounded p-2 break-all select-all font-mono">
                    {addr.address}
                  </code>
                </div>
              ))
            )}
          </div>

          <div className="pt-2 border-t space-y-2">
            <p className="text-sm text-muted-foreground">
              Після оплати зверніться в підтримку для підтвердження
            </p>
            <div className="flex gap-2">
              <Button 
                className="flex-1 gap-2" 
                onClick={() => {
                  onClose();
                  navigate("/balance");
                }}
              >
                <Wallet className="h-4 w-4" />
                Поповнити
              </Button>
              <Button variant="outline" asChild className="flex-1 gap-2">
                <a
                  href="https://t.me/dragonwhite7"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="h-4 w-4" />
                  Підтримка
                </a>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
