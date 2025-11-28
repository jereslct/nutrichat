import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Leaf, MessageSquare, Upload, Sparkles } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary to-background">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="flex justify-center">
            <div className="p-4 bg-primary/10 rounded-full">
              <Leaf className="h-16 w-16 text-primary" />
            </div>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            FoodTalk
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Tu asistente nutricional inteligente. Sube tu plan nutricional y conversa con nuestra IA
            para obtener respuestas personalizadas sobre tu dieta.
          </p>

          <div className="grid md:grid-cols-3 gap-6 mt-12">
            <div className="bg-card p-6 rounded-lg border border-border/50 shadow-sm hover:shadow-md transition-shadow">
              <Upload className="h-10 w-10 text-primary mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">Sube tu PDF</h3>
              <p className="text-sm text-muted-foreground">
                Carga tu plan nutricional en formato PDF de forma segura
              </p>
            </div>
            
            <div className="bg-card p-6 rounded-lg border border-border/50 shadow-sm hover:shadow-md transition-shadow">
              <Sparkles className="h-10 w-10 text-accent mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">IA Procesa</h3>
              <p className="text-sm text-muted-foreground">
                Nuestra IA analiza y comprende tu plan nutricional completo
              </p>
            </div>
            
            <div className="bg-card p-6 rounded-lg border border-border/50 shadow-sm hover:shadow-md transition-shadow">
              <MessageSquare className="h-10 w-10 text-primary mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">Pregunta</h3>
              <p className="text-sm text-muted-foreground">
                Haz cualquier consulta sobre tu dieta y obtén respuestas instantáneas
              </p>
            </div>
          </div>

          <div className="flex gap-4 justify-center mt-12">
            <Button 
              size="lg" 
              onClick={() => navigate("/auth")}
              className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
            >
              Comenzar Gratis
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => navigate("/auth")}
            >
              Iniciar Sesión
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
