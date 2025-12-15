import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Leaf, MessageSquare, Upload, Sparkles, ArrowRight, Check } from "lucide-react";

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
        </nav>

        <div className="max-w-4xl mx-auto">
          <div className="py-12 sm:py-20 text-center space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full mb-4">
                <span className="text-xs sm:text-sm font-medium text-primary">Asistente Nutricional IA</span>
              </div>

              <h1 className="text-display">
                Tu plan nutricional <span className="text-primary">inteligente</span>
              </h1>

              <p className="text-body-large max-w-2xl mx-auto text-neutral-600">
                Sube tu plan PDF y conversa con IA experta. Respuestas instantáneas, sin esperas, sin confusiones. Disponible 24/7.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Button
                size="lg"
                onClick={() => navigate("/auth")}
                className="bg-primary hover:bg-primary/90 text-white h-12 sm:h-11 px-6"
              >
                Probar Gratis
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("/auth")}
                className="h-12 sm:h-11 px-6 border border-neutral-300 text-neutral-900 hover:bg-neutral-50"
              >
                Iniciar Sesión
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-8 border-t border-neutral-200">
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-bold text-neutral-900">1,200+</p>
                <p className="text-xs sm:text-sm text-neutral-600 mt-1">Pacientes activos</p>
              </div>
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-bold text-neutral-900">15K+</p>
                <p className="text-xs sm:text-sm text-neutral-600 mt-1">Consultas respondidas</p>
              </div>
              <div className="col-span-2 sm:col-span-1 text-center">
                <p className="text-2xl sm:text-3xl font-bold text-neutral-900">100%</p>
                <p className="text-xs sm:text-sm text-neutral-600 mt-1">Privacidad garantizada</p>
              </div>
            </div>
          </div>

          <div className="py-16 sm:py-24 space-y-12">
            <div>
              <h2 className="text-heading-2 text-center mb-12 text-neutral-900">
                Cómo funciona
              </h2>

              <div className="grid md:grid-cols-3 gap-8">
                <div className="relative animate-scale-in" style={{ animationDelay: "0s" }}>
                  <div className="flex items-center justify-center mb-6">
                    <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center">
                      <span className="text-2xl font-bold text-primary">1</span>
                    </div>
                  </div>
                  <h3 className="text-heading-3 text-center text-neutral-900 mb-3">
                    Sube tu PDF
                  </h3>
                  <p className="text-body text-center text-neutral-600">
                    Carga tu plan nutricional. Totalmente seguro y encriptado.
                  </p>
                </div>

                <div className="relative animate-scale-in" style={{ animationDelay: "0.1s" }}>
                  <div className="flex items-center justify-center mb-6">
                    <div className="w-14 h-14 bg-accent/10 rounded-full flex items-center justify-center">
                      <span className="text-2xl font-bold text-accent">2</span>
                    </div>
                  </div>
                  <h3 className="text-heading-3 text-center text-neutral-900 mb-3">
                    IA lo analiza
                  </h3>
                  <p className="text-body text-center text-neutral-600">
                    Procesamiento inteligente de tu información nutricional.
                  </p>
                </div>

                <div className="relative animate-scale-in" style={{ animationDelay: "0.2s" }}>
                  <div className="flex items-center justify-center mb-6">
                    <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center">
                      <span className="text-2xl font-bold text-primary">3</span>
                    </div>
                  </div>
                  <h3 className="text-heading-3 text-center text-neutral-900 mb-3">
                    Conversa libremente
                  </h3>
                  <p className="text-body text-center text-neutral-600">
                    Haz preguntas y obtén respuestas instantáneas de expertos.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-neutral-50 rounded-2xl p-8 sm:p-12 space-y-8">
              <div>
                <h2 className="text-heading-2 text-neutral-900 mb-12">
                  Perfecto para
                </h2>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-heading-3 text-neutral-900">Pacientes</h3>
                  <ul className="space-y-3">
                    {["Dudas sobre porciones", "Sustituciones de alimentos", "Horarios de comidas", "Preguntas rápidas 24/7"].map((item) => (
                      <li key={item} className="flex items-center gap-3">
                        <Check className="h-5 w-5 text-primary flex-shrink-0" />
                        <span className="text-body text-neutral-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-4">
                  <h3 className="text-heading-3 text-neutral-900">Nutricionistas</h3>
                  <ul className="space-y-3">
                    {["Seguimiento de pacientes", "Monitorear adherencia", "Documentar evolución", "Consultas inteligentes"].map((item) => (
                      <li key={item} className="flex items-center gap-3">
                        <Check className="h-5 w-5 text-primary flex-shrink-0" />
                        <span className="text-body text-neutral-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="py-16 sm:py-24 text-center space-y-8 border-t border-neutral-200">
            <div className="space-y-3">
              <h2 className="text-heading-2 text-neutral-900">
                Comienza hoy
              </h2>
              <p className="text-body-large text-neutral-600 max-w-xl mx-auto">
                Sin tarjeta de crédito. Sin compromisos. Acceso completo a todas las funciones.
              </p>
            </div>

            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="bg-primary hover:bg-primary/90 text-white h-12 px-8"
            >
              Crear Cuenta
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>

        <footer className="border-t border-neutral-200 py-8 mt-16 text-center text-sm text-neutral-600">
          <p>© 2024 FoodTalk. Todos los derechos reservados.</p>
        </footer>
      </div>
    </div>
  );
};

export default Index;
