import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  Leaf, 
  ArrowRight, 
  ShoppingBasket, 
  Brain, 
  Clock, 
  FileWarning, 
  ShieldCheck,
  MessageCircle
} from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 sm:px-6">
        <nav className="flex items-center justify-between py-4 sm:py-6">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Leaf className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>
            <span className="font-bold text-lg sm:text-xl text-neutral-900">FoodTalk</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate("/auth")}
            className="text-neutral-600 hover:text-primary"
          >
            Iniciar Sesión
          </Button>
        </nav>

        <div className="max-w-5xl mx-auto">
          <div className="py-12 sm:py-20 text-center space-y-8">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 rounded-full mb-2 border border-red-100">
                <span className="text-xs sm:text-sm font-medium text-red-600">
                  ¿Cansado de abandonar dietas?
                </span>
              </div>

              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight tracking-tight text-neutral-900">
                Tu dieta no falla por falta de voluntad. <br className="hidden sm:block" />
                Falla por falta de <span className="text-primary">organización</span>.
              </h1>

              <p className="text-lg md:text-xl max-w-2xl mx-auto text-neutral-600">
                Los PDFs estáticos son imposibles de seguir en la vida real. 
                FoodTalk convierte tu plan nutricional en un <strong>Asistente Ejecutivo</strong> que organiza tus compras, recetas y decisiones difíciles por ti.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
              <Button
                size="lg"
                onClick={() => navigate("/auth")}
                className="bg-primary hover:bg-primary/90 text-primary-foreground h-14 px-8 text-lg shadow-lg transition-transform hover:scale-105"
              >
                Convertir mi PDF en Acción
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </div>
            
            <p className="text-xs text-neutral-400 mt-4">Prueba gratuita • Sin tarjeta de crédito requerida</p>
          </div>

          <div className="py-12 border-t border-neutral-100">
            <h2 className="text-2xl md:text-3xl font-semibold text-center text-neutral-900 mb-10">
              ¿Por qué es tan difícil seguir el plan?
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-neutral-50 p-6 rounded-2xl border border-neutral-100">
                <FileWarning className="h-10 w-10 text-orange-400 mb-4" />
                <h3 className="font-bold text-neutral-900 mb-2">El PDF Olvidado</h3>
                <p className="text-sm text-neutral-600">Guardas el plan en WhatsApp, pero nunca lo abres cuando realmente importa: en el supermercado.</p>
              </div>
              <div className="bg-neutral-50 p-6 rounded-2xl border border-neutral-100">
                <Brain className="h-10 w-10 text-orange-400 mb-4" />
                <h3 className="font-bold text-neutral-900 mb-2">Fatiga de Decisión</h3>
                <p className="text-sm text-neutral-600">Llegas cansado a casa y no tienes energía para calcular porciones. Terminas pidiendo delivery.</p>
              </div>
              <div className="bg-neutral-50 p-6 rounded-2xl border border-neutral-100">
                <MessageCircle className="h-10 w-10 text-orange-400 mb-4" />
                <h3 className="font-bold text-neutral-900 mb-2">Dudas sin Respuesta</h3>
                <p className="text-sm text-neutral-600">"¿Puedo comer esto?" Tu nutri no responde un sábado a las 9pm. FoodTalk sí.</p>
              </div>
            </div>
          </div>

          <div className="py-16 sm:py-24 space-y-12">
            <div>
              <h2 className="text-2xl md:text-3xl font-semibold text-center mb-4 text-neutral-900">
                Tu nueva "Prótesis Cognitiva"
              </h2>
              <p className="text-center text-neutral-600 max-w-2xl mx-auto">
                Deja de intentar memorizar tu dieta. Deja que la IA se encargue de la logística.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="relative p-6 rounded-2xl bg-white border border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-6">
                  <ShoppingBasket className="h-7 w-7 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-3">
                  Compras en 1 Clic
                </h3>
                <p className="text-neutral-600">
                  La IA lee tu PDF y genera la lista de supermercado exacta, organizada por pasillos.
                </p>
              </div>

              <div className="relative p-6 rounded-2xl bg-white border border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                  <Clock className="h-7 w-7 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-3">
                  Soporte Instantáneo
                </h3>
                <p className="text-neutral-600">
                  ¿Estás en un restaurante? Sácale una foto al menú. FoodTalk te dirá qué plato pedir.
                </p>
              </div>

              <div className="relative p-6 rounded-2xl bg-white border border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center mb-6">
                  <Brain className="h-7 w-7 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-3">
                  Traductor Nutricional
                </h3>
                <p className="text-neutral-600">
                  Convierte el "nutriñol" complejo en explicaciones simples.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-neutral-900 rounded-3xl p-8 sm:p-12 text-center text-white mb-20 relative overflow-hidden">
            <div className="relative z-10 space-y-6">
              <ShieldCheck className="h-12 w-12 text-primary mx-auto" />
              <h2 className="text-2xl sm:text-3xl font-bold">Sin Alucinaciones. 100% Tu Plan.</h2>
              <p className="text-neutral-300 max-w-2xl mx-auto text-lg">
                Usamos tecnología RAG. A diferencia de ChatGPT genérico, FoodTalk 
                <strong> solo</strong> usa la información clínica que subes en tu PDF.
              </p>
            </div>
          </div>

          <div className="py-16 text-center space-y-8">
            <div className="space-y-3">
              <h2 className="text-2xl md:text-3xl font-semibold text-neutral-900">
                Deja de luchar contra tu memoria
              </h2>
              <p className="text-lg text-neutral-600 max-w-xl mx-auto">
                Tu salud merece más que un papel arrugado en el bolsillo.
              </p>
            </div>

            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="bg-primary hover:bg-primary/90 text-primary-foreground h-12 px-10 text-lg"
            >
              Comenzar Gratis
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>

        <footer className="border-t border-neutral-200 py-8 mt-8 text-center text-sm text-neutral-500">
          <p>© 2025 FoodTalk. Diseñado para simplificar tu vida saludable.</p>
        </footer>
      </div>
    </div>
  );
};

export default Index;