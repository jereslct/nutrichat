import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload as UploadIcon, FileText, LogOut, Loader2, MessageSquare } from "lucide-react";
import { Session } from "@supabase/supabase-js";

const Upload = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("");
  const [existingDiet, setExistingDiet] = useState<any>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      } else {
        checkExistingDiet(session.user.id);
      }
    });
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
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast({
          title: "Archivo muy grande",
          description: "El archivo no debe superar los 10MB",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file || !session) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadStatus("Leyendo archivo...");
    
    try {
      // Simular progreso de lectura
      setUploadProgress(20);
      
      // Convertir FileReader a Promise
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

      // Obtener el token de sesión actual
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

      if (error) throw error;

      if (data?.error) {
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
      
      // Reset progress after a delay
      setTimeout(() => {
        setUploadProgress(0);
        setUploadStatus("");
      }, 2000);
    } catch (error: any) {
      console.error("Error uploading PDF:", error);
      setUploadStatus("Error en la carga");
      toast({
        title: "Error",
        description: error.message || "No se pudo procesar el PDF",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary to-background">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            NutriChat AI
          </h1>
          <Button variant="outline" onClick={handleLogout} size="sm">
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="shadow-lg border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UploadIcon className="h-5 w-5 text-primary" />
                Subir Plan Nutricional
              </CardTitle>
              <CardDescription>
                Sube tu plan nutricional en formato PDF para comenzar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="hidden"
                  id="pdf-upload"
                  disabled={uploading}
                />
                <label htmlFor="pdf-upload" className="cursor-pointer">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  {file ? (
                    <p className="text-sm font-medium">{file.name}</p>
                  ) : (
                    <>
                      <p className="text-sm font-medium mb-1">Haz clic para seleccionar</p>
                      <p className="text-xs text-muted-foreground">o arrastra tu archivo PDF aquí</p>
                    </>
                  )}
                </label>
              </div>
              {uploading && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{uploadStatus}</span>
                    <span className="font-medium">{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}
              
              <Button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="w-full"
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
            </CardContent>
          </Card>

          {existingDiet && (
            <Card className="shadow-lg border-border/50 bg-gradient-to-br from-card to-secondary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-accent" />
                  Chat con IA
                </CardTitle>
                <CardDescription>
                  Tu plan nutricional está listo para consultas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium mb-1">Plan actual:</p>
                  <p className="text-sm text-muted-foreground">{existingDiet.file_name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Subido el {new Date(existingDiet.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  onClick={() => navigate("/chat")}
                  className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Iniciar Chat
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default Upload;