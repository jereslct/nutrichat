import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubscribe = async () => {
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

      const { data, error } = await supabase.functions.invoke("create-subscription", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      // Redirect to MercadoPago subscription checkout
      if (data.init_point) {
        window.location.href = data.init_point;
      } else {
        throw new Error("No se pudo obtener la URL de suscripción");
      }
    } catch (error: any) {
      console.error("Error creating subscription:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo crear la suscripción",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewPlans = () => {
    onOpenChange(false);
    navigate("/subscription");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center">
            <Crown className="h-8 w-8 text-white" />
          </div>
          <DialogTitle className="text-2xl font-bold text-center">
            ¡Suscríbete a PRO!
          </DialogTitle>
          <DialogDescription className="text-center text-base">
            Has alcanzado tus 5 chats gratuitos. Suscríbete para acceso ilimitado a tu asistente nutricional.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h4 className="font-semibold text-foreground">Con NutriChat PRO:</h4>
            <ul className="space-y-2">
              {[
                "Chats ilimitados con tu asistente",
                "Análisis de fotos ilimitado",
                "Soporte prioritario",
                "Cancela cuando quieras",
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
              $16.999<span className="text-lg font-normal text-muted-foreground">/mes</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Suscripción mensual recurrente
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button 
            onClick={handleSubscribe} 
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
                Suscribirme ahora
              </>
            )}
          </Button>
          <Button 
            variant="outline" 
            onClick={handleViewPlans}
            disabled={loading}
          >
            Ver más detalles
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
