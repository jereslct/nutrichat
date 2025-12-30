import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Crown, Check, Loader2, ArrowLeft, Sparkles, MessageCircle, 
  Camera, Zap, Shield, User, Stethoscope, Users 
} from "lucide-react";
import { Session } from "@supabase/supabase-js";

interface PlanConfig {
  id: string;
  name: string;
  price: number;
  priceDisplay: string;
  description: string;
  features: { icon: React.ElementType; text: string }[];
  licenses?: number;
  recommended?: boolean;
  badge?: string;
}

const patientPlans: PlanConfig[] = [
  {
    id: "individual",
    name: "Plan Personal",
    price: 16999,
    priceDisplay: "$16.999",
    description: "Ideal para pacientes que quieren seguir su plan nutricional con IA",
    features: [
      { icon: MessageCircle, text: "Acceso completo al chat con tu asistente" },
      { icon: Camera, text: "Análisis detallado de tus comidas con IA" },
      { icon: Zap, text: "Respuestas prioritarias" },
      { icon: Shield, text: "Soporte premium" },
    ],
    recommended: true,
  },
];

const doctorPlans: PlanConfig[] = [
  {
    id: "doctor_basic",
    name: "Plan Médico Básico",
    price: 27999,
    priceDisplay: "$27.999",
    description: "Para profesionales que gestionan hasta 10 pacientes",
    licenses: 10,
    features: [
      { icon: Stethoscope, text: "Cuenta PRO Médico completa" },
      { icon: Users, text: "10 Licencias de pacientes incluidas" },
      { icon: MessageCircle, text: "Dashboard de seguimiento de pacientes" },
      { icon: Shield, text: "Soporte prioritario profesional" },
    ],
  },
  {
    id: "doctor_pro",
    name: "Plan Médico Plus",
    price: 43999,
    priceDisplay: "$43.999",
    description: "Para profesionales con alta demanda de pacientes",
    licenses: 25,
    features: [
      { icon: Stethoscope, text: "Cuenta PRO Médico completa" },
      { icon: Users, text: "25 Licencias de pacientes incluidas" },
      { icon: MessageCircle, text: "Dashboard de seguimiento de pacientes" },
      { icon: Zap, text: "Respuestas ultra-prioritarias" },
      { icon: Shield, text: "Soporte VIP dedicado" },
    ],
    recommended: true,
    badge: "MEJOR VALOR",
  },
];

const Subscription = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>("free");
  const [chatCount, setChatCount] = useState<number>(0);
  const [userRole, setUserRole] = useState<string>("patient");
  const [planTier, setPlanTier] = useState<string | null>(null);
  const [licensesCount, setLicensesCount] = useState<number>(0);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        if (!session) {
          navigate("/register");
        } else if (event === 'SIGNED_IN') {
          setTimeout(() => loadProfile(session.user.id), 0);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/register");
      } else {
        loadProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadProfile = async (userId: string) => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_status, chat_count, role, plan_tier, licenses_count")
      .eq("id", userId)
      .single();

    if (profile) {
      setSubscriptionStatus(profile.subscription_status || "free");
      setChatCount(profile.chat_count || 0);
      setUserRole(profile.role || "patient");
      setPlanTier(profile.plan_tier);
      setLicensesCount(profile.licenses_count || 0);
    }
  };

  const handleSubscribe = async (planId: string) => {
    setLoading(planId);
    
    try {
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !currentSession) {
        toast({
          title: "Sesión expirada",
          description: "Por favor, inicia sesión nuevamente",
          variant: "destructive",
        });
        navigate("/register");
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-subscription", {
        headers: {
          Authorization: `Bearer ${currentSession.access_token}`,
        },
        body: { plan_tier: planId },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

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
      setLoading(null);
    }
  };

  const isSubscribed = subscriptionStatus === "active";
  const tabFromUrl = searchParams.get("tab");
  const defaultTab = tabFromUrl || (userRole === "doctor" ? "profesionales" : "pacientes");

  const PlanCard = ({ plan, isDoctor = false }: { plan: PlanConfig; isDoctor?: boolean }) => (
    <div 
      className={`bg-white rounded-3xl border-2 ${plan.recommended ? 'border-amber-400 shadow-xl shadow-amber-100/50' : 'border-neutral-200'} p-6 sm:p-8 relative overflow-hidden flex flex-col h-full`}
    >
      {plan.badge && (
        <div className="absolute top-0 right-0 bg-amber-500 text-white px-4 py-1.5 text-xs font-semibold rounded-bl-2xl">
          {plan.badge}
        </div>
      )}
      
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-3">
          {isDoctor ? (
            <Stethoscope className="h-6 w-6 text-amber-500" />
          ) : (
            <Crown className="h-6 w-6 text-amber-500" />
          )}
          <span className="text-lg font-bold text-neutral-900">{plan.name}</span>
        </div>
        
        <div className="mb-4">
          <span className="text-4xl font-bold text-neutral-900">{plan.priceDisplay}</span>
          <span className="text-lg text-neutral-500">/mes</span>
        </div>

        <p className="text-sm text-neutral-600 mb-6">{plan.description}</p>

        {plan.licenses && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-600" />
              <span className="font-semibold text-amber-800">
                {plan.licenses} Licencias incluidas
              </span>
            </div>
            <p className="text-xs text-amber-700 mt-1">
              Invita pacientes que podrán usar NutriChat gratis
            </p>
          </div>
        )}

        <ul className="space-y-3">
          {plan.features.map((feature) => (
            <li key={feature.text} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="h-3.5 w-3.5 text-green-600" />
              </div>
              <span className="text-sm text-neutral-700">{feature.text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 pt-6 border-t border-neutral-100">
        {isSubscribed && planTier === plan.id ? (
          <div className="text-center p-4 bg-green-50 rounded-xl">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <p className="font-semibold text-green-800 mb-1">Plan Activo</p>
            {plan.licenses && (
              <p className="text-xs text-green-600">
                {licensesCount} licencias disponibles
              </p>
            )}
            <Button
              onClick={() => navigate(userRole === "doctor" ? "/dashboard" : "/chat")}
              className="mt-3 w-full"
              variant="outline"
            >
              {userRole === "doctor" ? "Ir al Dashboard" : "Ir al Chat"}
            </Button>
          </div>
        ) : isSubscribed ? (
          <Button variant="outline" className="w-full" disabled>
            Ya tienes un plan activo
          </Button>
        ) : (
          <Button
            onClick={() => handleSubscribe(plan.id)}
            disabled={loading !== null}
            size="lg"
            className={`w-full ${plan.recommended ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-lg shadow-amber-200' : ''}`}
          >
            {loading === plan.id ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <Crown className="h-4 w-4 mr-2" />
                Suscribirme
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50">
      {/* Header */}
      <header className="border-b border-neutral-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold text-neutral-900">Planes y Precios</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-8 max-w-5xl">
        {/* Hero Section */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Sparkles className="h-4 w-4" />
            {isSubscribed ? "Eres usuario PRO" : "Elige el plan perfecto para ti"}
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 mb-4">
            NutriChat <span className="text-amber-500">PRO</span>
          </h2>
          <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
            Tu asistente nutricional personal, siempre disponible.
            Planes para pacientes y profesionales de la salud.
          </p>
        </div>

        {/* Current Status for Free Users */}
        {!isSubscribed && userRole === "patient" && (
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 mb-8 text-center max-w-md mx-auto">
            <p className="text-neutral-600 mb-2">Tu uso actual</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-3xl font-bold text-neutral-900">{chatCount}</span>
              <span className="text-xl text-neutral-500">/ 5 chats gratuitos</span>
            </div>
            <div className="w-full bg-neutral-200 rounded-full h-2 mt-4">
              <div 
                className="bg-amber-500 h-2 rounded-full transition-all" 
                style={{ width: `${Math.min((chatCount / 5) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Plans Tabs */}
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
            <TabsTrigger value="pacientes" className="gap-2">
              <User className="h-4 w-4" />
              Pacientes
            </TabsTrigger>
            <TabsTrigger value="profesionales" className="gap-2">
              <Stethoscope className="h-4 w-4" />
              Profesionales
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pacientes">
            <div className="max-w-md mx-auto">
              {patientPlans.map((plan) => (
                <PlanCard key={plan.id} plan={plan} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="profesionales">
            <div className="grid md:grid-cols-2 gap-6">
              {doctorPlans.map((plan) => (
                <PlanCard key={plan.id} plan={plan} isDoctor />
              ))}
            </div>
            
            {/* Info Box for Doctors */}
            <div className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6 text-center">
              <Stethoscope className="h-10 w-10 text-blue-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                ¿Cómo funcionan las licencias?
              </h3>
              <p className="text-sm text-blue-700 max-w-lg mx-auto">
                Con tu plan médico, puedes invitar pacientes que tendrán acceso completo a NutriChat 
                sin costo adicional. Las licencias se renuevan cada mes con tu suscripción.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 mt-12 mb-12">
          {[
            {
              icon: MessageCircle,
              title: "Chat continuo",
              description: "Pregunta lo que necesites sobre tu plan nutricional y mantén el seguimiento día a día."
            },
            {
              icon: Camera,
              title: "Análisis de comidas",
              description: "Envía fotos de tus comidas y recibe feedback instantáneo sobre si están alineadas con tu dieta."
            },
            {
              icon: Shield,
              title: "Soporte prioritario",
              description: "Accede a atención preferencial y nuevas funciones antes que nadie."
            },
          ].map((feature) => (
            <div key={feature.title} className="bg-white rounded-2xl border border-neutral-200 p-6">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-4">
                <feature.icon className="h-6 w-6 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">{feature.title}</h3>
              <p className="text-neutral-600 text-sm">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-8">
          <h3 className="text-xl font-bold text-neutral-900 mb-6">Preguntas frecuentes</h3>
          <div className="space-y-6">
            {[
              {
                q: "¿Puedo cancelar cuando quiera?",
                a: "Sí, puedes cancelar tu suscripción en cualquier momento desde tu cuenta de MercadoPago. Tendrás acceso hasta el final del período pagado."
              },
              {
                q: "¿Qué métodos de pago aceptan?",
                a: "Aceptamos todos los métodos disponibles en MercadoPago: tarjetas de crédito/débito, transferencia bancaria, y más."
              },
              {
                q: "¿Qué pasa si mis pacientes superan las licencias?",
                a: "Puedes actualizar tu plan en cualquier momento para obtener más licencias. Tus pacientes existentes mantienen el acceso."
              },
              {
                q: "¿Las licencias se renuevan cada mes?",
                a: "Sí, cada vez que se procesa tu pago mensual, las licencias se renuevan al máximo de tu plan."
              },
            ].map((faq) => (
              <div key={faq.q}>
                <h4 className="font-medium text-neutral-900 mb-1">{faq.q}</h4>
                <p className="text-neutral-600 text-sm">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Back to app */}
        <div className="text-center mt-8">
          <Button variant="ghost" onClick={() => navigate(userRole === "doctor" ? "/dashboard" : "/chat")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Subscription;