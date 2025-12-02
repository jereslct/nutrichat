import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Leaf, Loader2, User, Stethoscope } from "lucide-react";
import { z } from "zod";

const emailSchema = z.string().email("Email inválido").max(255);
const passwordSchema = z.string().min(6, "La contraseña debe tener al menos 6 caracteres").max(100);
const nameSchema = z.string().trim().min(1, "El nombre es requerido").max(100);

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"patient" | "doctor">("patient");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        // Check user role first
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .single();

        if (roleData?.role === "doctor") {
          navigate("/dashboard");
          return;
        }

        // For patients, check if they have a diet loaded
        const { data: diets } = await supabase
          .from("diets")
          .select("id")
          .eq("user_id", session.user.id)
          .limit(1);
        
        if (diets && diets.length > 0) {
          navigate("/chat");
        } else {
          navigate("/upload");
        }
      }
    });
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validación
      emailSchema.parse(email);
      passwordSchema.parse(password);
      if (!isLogin) {
        nameSchema.parse(fullName);
      }

      if (isLogin) {
        const { data: authData, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast({
              title: "Error de autenticación",
              description: "Email o contraseña incorrectos",
              variant: "destructive",
            });
          } else {
            throw error;
          }
          return;
        }

        // Check user role
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", authData.user.id)
          .single();

        toast({
          title: "Inicio de sesión exitoso",
          description: "Bienvenido de vuelta",
        });

        if (roleData?.role === "doctor") {
          navigate("/dashboard");
        } else {
          // For patients, check if they have a diet loaded
          const { data: diets } = await supabase
            .from("diets")
            .select("id")
            .eq("user_id", authData.user.id)
            .limit(1);

          if (diets && diets.length > 0) {
            navigate("/chat");
          } else {
            navigate("/upload");
          }
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              full_name: fullName,
              role: role,
            },
          },
        });

        if (error) {
          if (error.message.includes("User already registered")) {
            toast({
              title: "Error de registro",
              description: "Este email ya está registrado. Intenta iniciar sesión.",
              variant: "destructive",
            });
          } else {
            throw error;
          }
          return;
        }

        toast({
          title: "Registro exitoso",
          description: "Tu cuenta ha sido creada. Redirigiendo...",
        });
        
        // Redirect based on role
        if (role === "doctor") {
          navigate("/dashboard");
        } else {
          navigate("/upload");
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Error de validación",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Ocurrió un error inesperado. Por favor intenta de nuevo.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary to-background p-4">
      <Card className="w-full max-w-md shadow-lg border-border/50">
        <CardHeader className="space-y-3 text-center">
          <div className="flex justify-center">
            <div className="p-3 bg-primary/10 rounded-full">
              <Leaf className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            FoodTalk
          </CardTitle>
          <CardDescription className="text-base">
            {isLogin ? "Inicia sesión en tu cuenta" : "Crea tu cuenta gratuita"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nombre completo</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Juan Pérez"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required={!isLogin}
                    disabled={loading}
                    className="transition-all"
                  />
                </div>
                <div className="space-y-3">
                  <Label>Tipo de cuenta</Label>
                  <RadioGroup
                    value={role}
                    onValueChange={(value) => setRole(value as "patient" | "doctor")}
                    className="grid grid-cols-2 gap-3"
                    disabled={loading}
                  >
                    <div>
                      <RadioGroupItem
                        value="patient"
                        id="patient"
                        className="peer sr-only"
                      />
                      <Label
                        htmlFor="patient"
                        className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 cursor-pointer transition-all"
                      >
                        <User className="mb-2 h-6 w-6" />
                        <span className="text-sm font-medium">Paciente</span>
                      </Label>
                    </div>
                    <div>
                      <RadioGroupItem
                        value="doctor"
                        id="doctor"
                        className="peer sr-only"
                      />
                      <Label
                        htmlFor="doctor"
                        className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 cursor-pointer transition-all"
                      >
                        <Stethoscope className="mb-2 h-6 w-6" />
                        <span className="text-sm font-medium">Doctor</span>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="transition-all"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="transition-all"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isLogin ? "Iniciando sesión..." : "Creando cuenta..."}
                </>
              ) : (
                <>{isLogin ? "Iniciar sesión" : "Crear cuenta"}</>
              )}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:underline font-medium transition-colors"
              disabled={loading}
            >
              {isLogin ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;