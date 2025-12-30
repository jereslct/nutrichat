import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Send, LogOut, Upload, Loader2, Bot, User as UserIcon, UserCircle, Camera, X, Image as ImageIcon, ImagePlus, Crown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Session } from "@supabase/supabase-js";
import { PremiumModal } from "@/components/PremiumModal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
interface Message {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
}

const Chat = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [dietId, setDietId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  // Check for payment status in URL
  useEffect(() => {
    const status = searchParams.get("status");
    if (status === "success") {
      toast({
        title: "¡Pago exitoso!",
        description: "Ya eres usuario PRO. ¡Disfruta de acceso ilimitado!",
      });
      // Clean URL
      window.history.replaceState({}, "", "/chat");
    } else if (status === "failure") {
      toast({
        title: "Pago fallido",
        description: "No se pudo procesar tu pago. Intenta nuevamente.",
        variant: "destructive",
      });
      window.history.replaceState({}, "", "/chat");
    } else if (status === "pending") {
      toast({
        title: "Pago pendiente",
        description: "Tu pago está siendo procesado. Te notificaremos cuando se complete.",
      });
      window.history.replaceState({}, "", "/chat");
    }
  }, [searchParams, toast]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        
        if (!session) {
          // Limpiar estado cuando el usuario cierra sesión
          setMessages([]);
          setDietId(null);
          setInput("");
          setSelectedImage(null);
          setImageFile(null);
          navigate("/register");
        } else if (event === 'SIGNED_IN') {
          // Cargar datos solo cuando hay un nuevo login
          setTimeout(() => {
            loadDietAndMessages(session.user.id);
          }, 0);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsInitialized(true);
      if (!session) {
        navigate("/register");
      } else {
        loadDietAndMessages(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadDietAndMessages = async (userId: string) => {
    // Load user profile for avatar
    const { data: profileData } = await supabase
      .from("profiles")
      .select("avatar_url, full_name")
      .eq("id", userId)
      .single();

    if (profileData) {
      setUserAvatar(profileData.avatar_url);
      setUserName(profileData.full_name);
    }

    const { data: diet } = await supabase
      .from("diets")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!diet) {
      toast({
        title: "No hay plan nutricional",
        description: "Por favor sube tu plan primero",
        variant: "destructive",
      });
      navigate("/upload");
      return;
    }

    setDietId(diet.id);

    const { data: chatMessages } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("user_id", userId)
      .eq("diet_id", diet.id)
      .order("created_at", { ascending: true });

    if (chatMessages) {
      setMessages(chatMessages.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })));
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return null;
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Archivo inválido",
        description: "Por favor selecciona una imagen",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Imagen muy grande",
        description: "La imagen debe ser menor a 5MB",
        variant: "destructive",
      });
      return;
    }

    setImageFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setSelectedImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const clearSelectedImage = () => {
    setSelectedImage(null);
    setImageFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSendImage = async (optionalText?: string) => {
    if (!selectedImage || !session || !dietId) return;

    const displayText = optionalText?.trim() 
      ? `📷 ${optionalText.trim()}` 
      : "📷 Foto de comida enviada";
    
    const userMessage: Message = { 
      role: "user", 
      content: displayText,
      imageUrl: selectedImage 
    };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    const imageToSend = selectedImage;
    const textToSend = optionalText?.trim() || "";
    clearSelectedImage();
    setInput(""); // Clear input after sending

    try {
      // Save user message
      await supabase.from("chat_messages").insert({
        user_id: session.user.id,
        diet_id: dietId,
        role: "user",
        content: textToSend ? `[Imagen de comida] ${textToSend}` : "[Imagen de comida]",
      });

      // Analyze image
      const { data, error } = await supabase.functions.invoke("analyze-food-image", {
        body: {
          imageBase64: imageToSend,
          dietId: dietId,
          userComment: textToSend, // Pass optional text to the edge function
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      const assistantMessage: Message = { role: "assistant", content: data.response };
      setMessages((prev) => [...prev, assistantMessage]);

      // Save assistant response
      await supabase.from("chat_messages").insert({
        user_id: session.user.id,
        diet_id: dietId,
        role: "assistant",
        content: data.response,
      });

      // Show remaining images
      if (data.usage) {
        toast({
          title: "Análisis completado",
          description: `Te quedan ${data.usage.imagesRemaining} fotos hoy`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo analizar la imagen",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    // If there's an image selected, send image with optional text
    if (selectedImage) {
      await handleSendImage(input);
      return;
    }

    if (!input.trim() || !session || !dietId) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      await supabase.from("chat_messages").insert({
        user_id: session.user.id,
        diet_id: dietId,
        role: "user",
        content: input,
      });

      const { data, error } = await supabase.functions.invoke("chat", {
        body: {
          message: input,
          dietId: dietId,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) {
        // Check if it's a 403 LIMIT_REACHED error
        if (error.message?.includes("403") || error.status === 403) {
          // Remove the user message we just added
          setMessages((prev) => prev.slice(0, -1));
          setShowPremiumModal(true);
          return;
        }
        throw error;
      }

      if (data.error) {
        // Check for LIMIT_REACHED error from response
        if (data.error === "LIMIT_REACHED") {
          // Remove the user message we just added
          setMessages((prev) => prev.slice(0, -1));
          setShowPremiumModal(true);
          return;
        }
        throw new Error(data.error);
      }

      const assistantMessage: Message = { role: "assistant", content: data.response };
      setMessages((prev) => [...prev, assistantMessage]);

      await supabase.from("chat_messages").insert({
        user_id: session.user.id,
        diet_id: dietId,
        role: "assistant",
        content: data.response,
      });
    } catch (error: any) {
      // Also check for LIMIT_REACHED in generic error handler
      if (error.message?.includes("LIMIT_REACHED") || error.status === 403) {
        setMessages((prev) => prev.slice(0, -1));
        setShowPremiumModal(true);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "No se pudo enviar el mensaje",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/register");
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-white">
      <header className="border-b border-neutral-200 bg-white shrink-0">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center">
          <h1 className="text-lg sm:text-xl font-bold text-neutral-900">
            NutriChat
          </h1>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => navigate("/subscription")}
              size="sm"
              className="px-2 sm:px-3 text-amber-600 hover:bg-amber-50"
            >
              <Crown className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">PRO</span>
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate("/profile")}
              size="sm"
              className="px-2 sm:px-3 text-neutral-700 hover:bg-neutral-100"
            >
              <UserCircle className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Perfil</span>
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate("/upload")}
              size="sm"
              className="px-2 sm:px-3 text-neutral-700 hover:bg-neutral-100"
            >
              <Upload className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Nuevo plan</span>
            </Button>
            <Button
              variant="ghost"
              onClick={handleLogout}
              size="sm"
              className="px-2 sm:px-3 text-neutral-700 hover:bg-neutral-100"
            >
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Salir</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0 bg-neutral-50">
        <div className="container mx-auto max-w-3xl space-y-6">
          {messages.length === 0 ? (
            <div className="py-12 sm:py-20 text-center space-y-6 animate-fade-in">
              <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                <Bot className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-heading-3 text-neutral-900">Hola, soy tu asistente nutricional</h2>
                <p className="text-body text-neutral-600 max-w-md mx-auto">
                  Estoy aquí para ayudarte con cualquier pregunta sobre tu plan nutricional. También puedes enviarme fotos de tu comida y te diré si está alineada con tu plan.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-neutral-500">
                <Camera className="h-4 w-4" />
                <span>Puedes enviar hasta 3 fotos de comida por día</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 max-w-md mx-auto">
                {["¿Qué puedo comer de colación?", "¿Puedo sustituir este alimento?", "¿Cuánta agua debo beber?", "¿Qué hacer en fin de semana?"].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setInput(suggestion);
                      setTimeout(() => handleSend(), 100);
                    }}
                    className="text-left text-sm px-4 py-3 rounded-lg border border-neutral-300 text-neutral-700 hover:bg-neutral-100 transition-colors interactive"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 animate-slide-up ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] sm:max-w-[75%] ${
                    msg.role === "user" ? "flex flex-col items-end" : ""
                  }`}
                >
                  {msg.imageUrl && (
                    <div className="mb-2 rounded-lg overflow-hidden max-w-[200px]">
                      <img 
                        src={msg.imageUrl} 
                        alt="Comida enviada" 
                        className="w-full h-auto object-cover"
                      />
                    </div>
                  )}
                  <div
                    className={`rounded-2xl px-4 sm:px-5 py-3 sm:py-4 ${
                      msg.role === "user"
                        ? "bg-primary text-white rounded-br-none"
                        : "bg-white border border-neutral-200 text-neutral-900 rounded-bl-none"
                    }`}
                  >
                    <p className="text-sm sm:text-base whitespace-pre-wrap break-words leading-relaxed">
                      {msg.content}
                    </p>
                  </div>
                </div>
                {msg.role === "user" && (
                  <Avatar className="flex-shrink-0 w-8 h-8 mt-0.5">
                    <AvatarImage src={userAvatar || ""} alt="Tu avatar" />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                      {getInitials(userName) || <UserIcon className="h-4 w-4" />}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))
          )}
          {loading && (
            <div className="flex gap-3 justify-start animate-slide-up">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div className="bg-white border border-neutral-200 rounded-2xl rounded-bl-none px-5 py-4">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "0s" }} />
                  <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                  <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      <footer className="border-t border-neutral-200 bg-white p-4 sm:p-6 shrink-0 safe-bottom">
        <div className="container mx-auto max-w-3xl">
          {/* Image preview */}
          {selectedImage && (
            <div className="mb-3 relative inline-block">
              <img 
                src={selectedImage} 
                alt="Preview" 
                className="h-20 w-20 object-cover rounded-lg border border-neutral-300"
              />
              <button
                onClick={clearSelectedImage}
                className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1 hover:bg-destructive/90 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          
          <div className="flex gap-3">
            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageSelect}
              className="hidden"
            />

            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={selectedImage ? "Agrega un comentario (opcional)..." : "Escribe tu pregunta..."}
              onKeyPress={(e) => e.key === "Enter" && !loading && handleSend()}
              disabled={loading}
              className="flex-1 text-base h-11 rounded-lg border-neutral-300 bg-neutral-50"
            />
            
            {/* Camera/Gallery dropdown - hide when image is selected */}
            {!selectedImage && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={loading}
                    className="h-11 w-11 shrink-0 border-neutral-300"
                    title="Subir foto de comida"
                  >
                    <Camera className="h-5 w-5 text-neutral-600" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => cameraInputRef.current?.click()} className="cursor-pointer">
                    <Camera className="h-4 w-4 mr-2" />
                    Tomar foto
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="cursor-pointer">
                    <ImagePlus className="h-4 w-4 mr-2" />
                    Elegir de galería
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <Button
              onClick={handleSend}
              disabled={loading || (!input.trim() && !selectedImage)}
              className={selectedImage 
                ? "bg-green-600 hover:bg-green-700 text-white px-4 h-11 interactive" 
                : "bg-primary hover:bg-primary/90 text-white px-4 h-11 interactive"
              }
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </footer>

      {/* Premium Modal */}
      <PremiumModal 
        open={showPremiumModal} 
        onOpenChange={setShowPremiumModal} 
      />
    </div>
  );
};

export default Chat;
