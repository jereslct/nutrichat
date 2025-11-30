import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, FileText, Calendar, User } from "lucide-react";
import { Session } from "@supabase/supabase-js";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Diet {
  id: string;
  file_name: string;
  created_at: string;
}

interface Profile {
  full_name: string | null;
}

const Profile = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [diet, setDiet] = useState<Diet | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      } else {
        loadUserData(session.user.id);
      }
    });

    supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      }
    });
  }, [navigate]);

  const loadUserData = async (userId: string) => {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .single();

    if (profileData) {
      setProfile(profileData);
    }

    const { data: dietData } = await supabase
      .from("diets")
      .select("id, file_name, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (dietData) {
      setDiet(dietData);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getInitials = (name: string | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-gradient-to-br from-background via-secondary to-background">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm shrink-0">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex justify-between items-center">
          <Button
            variant="ghost"
            onClick={() => navigate("/chat")}
            size="sm"
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Volver</span>
          </Button>
          <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Mi Perfil
          </h1>
          <div className="w-[60px] sm:w-[80px]"></div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-3 sm:p-6">
        <div className="container mx-auto max-w-2xl space-y-4 sm:space-y-6">
          <Card className="p-4 sm:p-6 bg-gradient-to-br from-card to-secondary/20 border-border/50">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 sm:h-20 sm:w-20">
                <AvatarImage src="" />
                <AvatarFallback className="bg-primary/10 text-primary text-xl sm:text-2xl font-bold">
                  {getInitials(profile?.full_name || session?.user?.email || null)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                  {profile?.full_name || "Usuario"}
                </h2>
                <p className="text-sm sm:text-base text-muted-foreground truncate">
                  {session?.user?.email}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4 sm:p-6 bg-card border-border/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-foreground">
                Plan Nutricional
              </h3>
            </div>

            {diet ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/20">
                  <User className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground mb-1">Nombre del plan</p>
                    <p className="text-sm sm:text-base font-medium text-foreground break-words">
                      {diet.file_name}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/20">
                  <Calendar className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground mb-1">Fecha de carga</p>
                    <p className="text-sm sm:text-base font-medium text-foreground">
                      {formatDate(diet.created_at)}
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  onClick={() => navigate("/upload")}
                  className="w-full mt-2"
                >
                  Actualizar plan
                </Button>
              </div>
            ) : (
              <div className="text-center py-6">
                <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-4">
                  No tienes ningún plan nutricional cargado
                </p>
                <Button onClick={() => navigate("/upload")}>
                  Subir plan
                </Button>
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Profile;
