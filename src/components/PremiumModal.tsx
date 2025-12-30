import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Check, Loader2 } from "lucide-react";

interface PremiumModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PremiumModal = ({ open, onOpenChange }: PremiumModalProps) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleUpgrade = async () => {
    setLoading(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Error",
          description: "Debes iniciar sesión para continuar",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-preference", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      // Redirect to MercadoPago checkout
      // Use init_point for production, sandbox_init_point for testing
      const checkoutUrl = data.init_point || data.sandbox_init_point;
      
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        throw new Error("No se pudo obtener la URL de pago");
      }
    } catch (error: any) {
      console.error("Error creating preference:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo procesar el pago",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center">
            <Crown className="h-8 w-8 text-white" />
          </div>
          <DialogTitle className="text-2xl font-bold text-center">
            ¡Pasa a PRO!
          </DialogTitle>
          <DialogDescription className="text-center text-base">
            Has alcanzado tus 5 chats gratuitos. Desbloquea acceso ilimitado a tu asistente nutricional.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h4 className="font-semibold text-foreground">Con FoodTalk PRO:</h4>
            <ul className="space-y-2">
              {[
                "Chats ilimitados con tu asistente",
                "Análisis de fotos ilimitado",
                "Soporte prioritario",
                "Nuevas funciones antes que nadie",
              ].map((benefit) => (
                <li key={benefit} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-green-500 shrink-0" />
                  {benefit}
                </li>
              ))}
            </ul>
          </div>

          <div className="text-center">
            <div className="text-3xl font-bold text-foreground">
              $2.999<span className="text-lg font-normal text-muted-foreground">/mes</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Cancela cuando quieras
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button 
            onClick={handleUpgrade} 
            disabled={loading}
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <Crown className="h-4 w-4 mr-2" />
                Pasar a PRO
              </>
            )}
          </Button>
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Quizás más tarde
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
