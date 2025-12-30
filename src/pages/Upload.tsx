import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload as UploadIcon, LogOut, Loader2, MessageSquare, Trash2, UserCircle } from "lucide-react";
import { Session } from "@supabase/supabase-js";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PremiumModal } from "@/components/PremiumModal";

const MAX_FILE_SIZE_MB = 6;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const Upload = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("");
  const [existingDiet, setExistingDiet] = useState<any>(null);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        
        if (!session) {
          // Limpiar estado cuando el usuario cierra sesión
          setFile(null);
          setExistingDiet(null);
          setUploadProgress(0);
          setUploadStatus("");
          navigate("/register");
        } else if (event === 'SIGNED_IN') {
          // Cargar datos solo cuando hay un nuevo login
          setTimeout(() => {
            checkExistingDiet(session.user.id);
          }, 0);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/register");
      } else {
        checkExistingDiet(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkExistingDiet = async (userId: string) => {
    const { data, error } = await supabase
      .from("diets")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      setExistingDiet(data);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== "application/pdf") {
        toast({
          title: "Archivo inválido",
          description: "Por favor selecciona un archivo PDF",
          variant: "destructive",
        });
        return;
      }
      if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
        toast({
          title: "Archivo muy grande",
          description: `El archivo no debe superar los ${MAX_FILE_SIZE_MB}MB`,
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file || !session) return;

    // Validación de tamaño antes de intentar subir
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast({
        title: "Archivo muy grande",
        description: `El archivo es demasiado grande (Máx ${MAX_FILE_SIZE_MB}MB)`,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadStatus("Leyendo archivo...");
    
    try {
      setUploadProgress(20);
      
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Error leyendo el archivo"));
        reader.readAsDataURL(file);
      });

      setUploadProgress(40);
      setUploadStatus("Extrayendo contenido del PDF...");

      const base64Content = base64.split(",")[1];

      setUploadProgress(60);
      setUploadStatus("Procesando con IA...");

      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (!currentSession?.access_token) {
        throw new Error("No hay sesión activa. Por favor, inicia sesión nuevamente.");
      }

      const { data, error } = await supabase.functions.invoke("upload-pdf", {
        body: { 
          pdf: base64Content,
          fileName: file.name,
        },
      });

      // Manejar errores de la Edge Function
      if (error) {
        console.error("Error de invoke:", error);
        
        // Verificar si es error de límite (403)
        const errorBody = error.message || "";
        if (errorBody.includes("LIMIT_REACHED") || errorBody.includes("403")) {
          setShowPremiumModal(true);
          setUploadStatus("");
          setUploadProgress(0);
          return;
        }
        
        throw error;
      }

      // Verificar errores en el cuerpo de respuesta
      if (data?.error) {
        if (data.error === "LIMIT_REACHED") {
          setShowPremiumModal(true);
          setUploadStatus("");
          setUploadProgress(0);
          return;
        }
        throw new Error(data.error);
      }

      setUploadProgress(90);
      setUploadStatus("Guardando en la base de datos...");

      await checkExistingDiet(session.user.id);
      
      setUploadProgress(100);
      setUploadStatus("¡Completado!");

      toast({
        title: "¡Éxito!",
        description: "Tu plan nutricional ha sido procesado correctamente",
      });

      setFile(null);
      
      setTimeout(() => {
        setUploadProgress(0);
        setUploadStatus("");
      }, 2000);
    } catch (error: any) {
      console.error("Error uploading PDF:", error);
      setUploadStatus("Error en la carga");
      
      // Mostrar mensaje de error detallado del backend
      const errorMessage = error?.context?.body 
        ? JSON.parse(error.context.body)?.error 
        : error.message || "No se pudo procesar el PDF";
      
      toast({
        title: "Error al procesar PDF",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDiet = async () => {
    if (!existingDiet || !session) return;

    try {
      const { error } = await supabase
        .from("diets")
        .delete()
        .eq("id", existingDiet.id)
        .eq("user_id", session.user.id);

      if (error) throw error;

      // También eliminar los mensajes del chat asociados
      await supabase
        .from("chat_messages")
        .delete()
        .eq("diet_id", existingDiet.id)
        .eq("user_id", session.user.id);

      toast({
        title: "Plan eliminado",
        description: "Tu plan nutricional ha sido eliminado correctamente",
      });

      setExistingDiet(null);
    } catch (error: any) {
      console.error("Error deleting diet:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el plan",
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/register");
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-neutral-200 bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center">
          <h1 className="text-lg sm:text-xl font-bold text-neutral-900">
            NutriChat
          </h1>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => navigate("/profile")} size="sm" className="text-neutral-700 hover:bg-neutral-100">
              <UserCircle className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Perfil</span>
            </Button>
            {existingDiet && (
              <Button variant="ghost" onClick={() => navigate("/chat")} size="sm" className="text-neutral-700 hover:bg-neutral-100">
                <MessageSquare className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Chat</span>
              </Button>
            )}
            <Button variant="ghost" onClick={handleLogout} size="sm" className="text-neutral-700 hover:bg-neutral-100">
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Salir</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 max-w-5xl">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-6">
            <div className="space-y-2">
              <h1 className="text-heading-2 text-neutral-900">
                Sube tu plan
              </h1>
              <p className="text-body text-neutral-600">
                Carga tu plan nutricional en PDF para comenzar a recibir respuestas personalizadas.
              </p>
            </div>

            <div className="space-y-4">
              <div className="border-2 border-dashed border-neutral-300 rounded-2xl p-8 sm:p-12 text-center hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group interactive">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="hidden"
                  id="pdf-upload"
                  disabled={uploading}
                />
                <label htmlFor="pdf-upload" className="cursor-pointer block">
                  <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                    <UploadIcon className="h-8 w-8 text-primary" />
                  </div>
                  {file ? (
                    <>
                      <p className="text-heading-3 text-neutral-900 mb-1">{file.name}</p>
                      <p className="text-sm text-neutral-600">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </>
                  ) : (
                    <>
                      <p className="text-heading-3 text-neutral-900 mb-2">Arrastrá tu archivo</p>
                      <p className="text-body text-neutral-600 mb-2">o hacé clic para seleccionar</p>
                      <p className="text-sm text-neutral-500">
                        PDF • Máx 10MB • Seguro y privado
                      </p>
                    </>
                  )}
                </label>
              </div>

              {uploading && (
                <div className="space-y-4 animate-fade-in">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-700 font-medium">{uploadStatus}</span>
                      <span className="text-neutral-600 tabular-nums">{uploadProgress}%</span>
                    </div>
                    <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-500"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-900">
                      💡 <strong>Tip:</strong> Mientras procesamos tu plan, podés pensar en tus preguntas.
                    </p>
                  </div>
                </div>
              )}

              <Button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="w-full bg-primary hover:bg-primary/90 text-white h-11 interactive"
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <UploadIcon className="mr-2 h-4 w-4" />
                    Subir PDF
                  </>
                )}
              </Button>
            </div>
          </div>

          {existingDiet && (
            <div className="space-y-6 bg-neutral-50 rounded-2xl p-6 sm:p-8 h-fit md:sticky md:top-24 animate-slide-up">
              <div className="space-y-3">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                    <MessageSquare className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-heading-3 text-neutral-900">Tu plan está listo</h2>
                    <p className="text-sm text-neutral-600">Comienza a conversar</p>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-neutral-200 rounded-lg p-4 space-y-2">
                <p className="text-xs font-medium text-neutral-600 uppercase">Plan actual</p>
                <p className="text-sm font-medium text-neutral-900">{existingDiet.file_name}</p>
                <p className="text-xs text-neutral-500">
                  Subido el {new Date(existingDiet.created_at).toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" })}
                </p>
              </div>

              <Button
                onClick={() => navigate("/chat")}
                className="w-full bg-primary hover:bg-primary/90 text-white h-11 interactive"
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                Iniciar Chat
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="w-full border-red-200 text-red-700 hover:bg-red-50">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar Plan
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esto eliminará permanentemente tu plan y todo el historial de chat. No se puede deshacer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteDiet} className="bg-destructive hover:bg-destructive/90">
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </main>

      <PremiumModal 
        open={showPremiumModal} 
        onOpenChange={setShowPremiumModal} 
      />
    </div>
  );
};

export default Upload;