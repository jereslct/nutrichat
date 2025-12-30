import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Crown, Check, Loader2, ArrowLeft, Sparkles, MessageCircle, Camera, Zap, Shield } from "lucide-react";
import { Session } from "@supabase/supabase-js";

const Subscription = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>("free");
  const [chatCount, setChatCount] = useState<number>(0);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        if (!session) {
          navigate("/auth");
        } else if (event === 'SIGNED_IN') {
          setTimeout(() => loadProfile(session.user.id), 0);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      } else {
        loadProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadProfile = async (userId: string) => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_status, chat_count")
      .eq("id", userId)
      .single();

    if (profile) {
      setSubscriptionStatus(profile.subscription_status || "free");
      setChatCount(profile.chat_count || 0);
    }
  };

  const handleSubscribe = async () => {
    if (!session) return;
    
    setLoading(true);
    
    try {
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

  const isSubscribed = subscriptionStatus === "active";

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
          <h1 className="text-xl font-bold text-neutral-900">Suscripción</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-8 max-w-4xl">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Sparkles className="h-4 w-4" />
            {isSubscribed ? "Eres usuario PRO" : "Desbloquea todo el potencial"}
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-neutral-900 mb-4">
            FoodTalk <span className="text-amber-500">PRO</span>
          </h2>
          <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
            Tu asistente nutricional personal, sin límites. 
            Chatea, analiza fotos y alcanza tus metas de salud.
          </p>
        </div>

        {/* Current Status */}
        {!isSubscribed && (
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 mb-8 text-center">
            <p className="text-neutral-600 mb-2">Tu uso actual</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-3xl font-bold text-neutral-900">{chatCount}</span>
              <span className="text-xl text-neutral-500">/ 5 chats gratuitos</span>
            </div>
            <div className="w-full bg-neutral-200 rounded-full h-2 mt-4 max-w-xs mx-auto">
              <div 
                className="bg-amber-500 h-2 rounded-full transition-all" 
                style={{ width: `${Math.min((chatCount / 5) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Pricing Card */}
        <div className="bg-white rounded-3xl border-2 border-amber-400 shadow-xl shadow-amber-100/50 p-8 mb-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-amber-500 text-white px-6 py-2 text-sm font-semibold rounded-bl-2xl">
            RECOMENDADO
          </div>
          
          <div className="flex flex-col lg:flex-row gap-8 items-center">
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 mb-4">
                <Crown className="h-8 w-8 text-amber-500" />
                <span className="text-2xl font-bold text-neutral-900">Plan PRO</span>
              </div>
              
              <div className="mb-6">
                <span className="text-5xl font-bold text-neutral-900">$2.999</span>
                <span className="text-xl text-neutral-500">/mes</span>
              </div>

              <ul className="space-y-4 text-left">
                {[
                  { icon: MessageCircle, text: "Chats ilimitados con tu asistente" },
                  { icon: Camera, text: "Análisis de fotos ilimitado" },
                  { icon: Zap, text: "Respuestas prioritarias" },
                  { icon: Shield, text: "Soporte premium" },
                ].map((feature) => (
                  <li key={feature.text} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                      <Check className="h-4 w-4 text-green-600" />
                    </div>
                    <span className="text-neutral-700">{feature.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="w-full lg:w-auto">
              {isSubscribed ? (
                <div className="text-center p-6 bg-green-50 rounded-2xl">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="h-8 w-8 text-green-600" />
                  </div>
                  <p className="text-lg font-semibold text-green-800 mb-2">
                    ¡Ya eres PRO!
                  </p>
                  <p className="text-sm text-green-600">
                    Disfruta de acceso ilimitado
                  </p>
                  <Button
                    onClick={() => navigate("/chat")}
                    className="mt-4 w-full"
                    variant="outline"
                  >
                    Ir al Chat
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handleSubscribe}
                  disabled={loading}
                  size="lg"
                  className="w-full lg:w-auto px-12 py-6 text-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-lg shadow-amber-200"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <Crown className="h-5 w-5 mr-2" />
                      Suscribirme ahora
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {[
            {
              icon: MessageCircle,
              title: "Chats sin límites",
              description: "Pregunta todo lo que necesites sobre tu plan nutricional, sin restricciones."
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
                q: "¿Los chats gratuitos se renuevan?",
                a: "No, los 5 chats gratuitos son un límite único para probar la app. Una vez alcanzados, necesitarás suscribirte para continuar."
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
          <Button variant="ghost" onClick={() => navigate("/chat")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver al chat
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Subscription;
