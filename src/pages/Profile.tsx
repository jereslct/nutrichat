import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, FileText, Calendar, User, Camera, Loader2, Save, X, Pencil, Stethoscope } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { DoctorSelector } from "@/components/DoctorSelector";
import { LinkRequestsNotification } from "@/components/LinkRequestsNotification";
import { Session } from "@supabase/supabase-js";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AvatarCropDialog } from "@/components/AvatarCropDialog";

interface Diet {
  id: string;
  file_name: string;
  created_at: string;
}

interface ProfileData {
  full_name: string | null;
  avatar_url: string | null;
  specialty: string | null;
}

const SPECIALTIES = [
  "Nutricionista",
  "Médico General",
  "Psicólogo",
  "Cirujano",
  "Endocrinólogo",
  "Cardiólogo",
  "Dermatólogo",
  "Otro",
];

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(100, "El nombre no puede superar 100 caracteres"),
});

const Profile = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [diet, setDiet] = useState<Diet | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const { role } = useUserRole();
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [selectedImageSrc, setSelectedImageSrc] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [specialty, setSpecialty] = useState<string>("");

  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: "",
    },
  });

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        
        if (!session) {
          // Limpiar estado cuando el usuario cierra sesión
          setProfile(null);
          setDiet(null);
          setIsEditing(false);
          navigate("/auth");
        } else if (event === 'SIGNED_IN') {
          // Cargar datos solo cuando hay un nuevo login
          setTimeout(() => {
            loadUserData(session.user.id);
          }, 0);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      } else {
        loadUserData(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadUserData = async (userId: string) => {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name, avatar_url, specialty")
      .eq("id", userId)
      .single();

    if (profileData) {
      setProfile(profileData);
      setValue("full_name", profileData.full_name || "");
      setSpecialty(profileData.specialty || "");
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

  const handleAvatarClick = () => {
    if (isEditing) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de archivo
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Error",
        description: "Por favor selecciona una imagen JPG, PNG o WebP",
        variant: "destructive",
      });
      return;
    }

    // Validar tamaño (5MB)
    if (file.size > 5242880) {
      toast({
        title: "Error",
        description: "La imagen no puede superar 5MB",
        variant: "destructive",
      });
      return;
    }

    // Crear preview para el crop
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImageSrc(reader.result as string);
      setShowCropDialog(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (croppedImage: Blob) => {
    if (!session) return;

    setIsUploading(true);

    try {
      // Eliminar avatar anterior si existe
      if (profile?.avatar_url) {
        const oldPath = profile.avatar_url.split("/").pop();
        if (oldPath) {
          await supabase.storage
            .from("avatars")
            .remove([`${session.user.id}/${oldPath}`]);
        }
      }

      // Subir nuevo avatar croppeado
      const fileName = `${Math.random()}.jpg`;
      const filePath = `${session.user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, croppedImage);

      if (uploadError) throw uploadError;

      // Obtener URL pública
      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      // Actualizar base de datos
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", session.user.id);

      if (updateError) throw updateError;

      setProfile((prev) => prev ? { ...prev, avatar_url: publicUrl } : null);

      toast({
        title: "¡Éxito!",
        description: "Foto de perfil actualizada correctamente",
      });
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la foto de perfil",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setShowCropDialog(false);
      setSelectedImageSrc("");
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const onSubmit = async (data: z.infer<typeof profileSchema>) => {
    if (!session) return;

    setIsSaving(true);

    try {
      const updateData: { full_name: string; specialty?: string } = { 
        full_name: data.full_name 
      };
      
      // Si es doctor, también guardar la especialidad
      if (role === "doctor") {
        updateData.specialty = specialty;
      }
      
      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", session.user.id);

      if (error) throw error;

      setProfile((prev) => prev ? { ...prev, full_name: data.full_name, specialty: specialty } : null);
      setIsEditing(false);

      toast({
        title: "¡Éxito!",
        description: "Perfil actualizado correctamente",
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el perfil",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    reset({ full_name: profile?.full_name || "" });
    setSpecialty(profile?.specialty || "");
    setIsEditing(false);
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
    <>
      <AvatarCropDialog
        open={showCropDialog}
        imageSrc={selectedImageSrc}
        onClose={() => {
          setShowCropDialog(false);
          setSelectedImageSrc("");
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }}
        onCropComplete={handleCropComplete}
      />

      <div className="min-h-[100dvh] flex flex-col bg-gradient-to-br from-background via-secondary to-background">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm shrink-0">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex justify-between items-center">
          <Button
            variant="ghost"
            onClick={() => navigate(role === "doctor" ? "/dashboard" : "/chat")}
            size="sm"
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Volver</span>
          </Button>
          <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Mi Perfil
          </h1>
          <LinkRequestsNotification />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-3 sm:p-6">
        <div className="container mx-auto max-w-2xl space-y-4 sm:space-y-6">
          <Card className="p-4 sm:p-6 bg-gradient-to-br from-card to-secondary/20 border-border/50">
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="flex flex-col items-center gap-4 mb-6">
                <div className="relative">
                  <Avatar 
                    className="h-24 w-24 sm:h-28 sm:w-28 cursor-pointer ring-2 ring-border/50"
                    onClick={handleAvatarClick}
                  >
                    <AvatarImage src={profile?.avatar_url || ""} />
                    <AvatarFallback className="bg-primary/10 text-primary text-3xl sm:text-4xl font-bold">
                      {getInitials(profile?.full_name || session?.user?.email || null)}
                    </AvatarFallback>
                  </Avatar>
                  {isEditing && (
                    <div 
                      onClick={handleAvatarClick}
                      className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center cursor-pointer opacity-0 hover:opacity-100 transition-opacity"
                    >
                      {isUploading ? (
                        <Loader2 className="h-8 w-8 text-white animate-spin" />
                      ) : (
                        <Camera className="h-8 w-8 text-white" />
                      )}
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={!isEditing}
                  />
                </div>
                
                {isEditing ? (
                  <div className="w-full space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="full_name">Nombre completo</Label>
                      <Input
                        id="full_name"
                        {...register("full_name")}
                        placeholder="Tu nombre completo"
                        className="text-center sm:text-left"
                      />
                      {errors.full_name && (
                        <p className="text-sm text-destructive text-center sm:text-left">
                          {errors.full_name.message}
                        </p>
                      )}
                    </div>
                    
                    {role === "doctor" && (
                      <div className="space-y-2">
                        <Label htmlFor="specialty">Especialidad</Label>
                        <Select value={specialty} onValueChange={setSpecialty}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona tu especialidad" />
                          </SelectTrigger>
                          <SelectContent>
                            {SPECIALTIES.map((spec) => (
                              <SelectItem key={spec} value={spec}>
                                {spec}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center">
                    <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                      {profile?.full_name || "Usuario"}
                    </h2>
                    <p className="text-sm sm:text-base text-muted-foreground">
                      {session?.user?.email}
                    </p>
                    {role === "doctor" && profile?.specialty && (
                      <p className="text-sm text-accent mt-1">{profile.specialty}</p>
                    )}
                  </div>
                )}
              </div>

              {isEditing ? (
                <div className="flex gap-2 justify-center">
                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="gap-2"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Guardar cambios
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="gap-2"
                  >
                    <X className="h-4 w-4" />
                    Cancelar
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                  className="w-full gap-2"
                >
                  <Pencil className="h-4 w-4" />
                  Editar perfil
                </Button>
              )}
            </form>
          </Card>

          {role === "patient" && (
            <>
              <DoctorSelector />
              
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
            </>
          )}
        </div>
      </main>
    </div>
    </>
  );
};

export default Profile;
