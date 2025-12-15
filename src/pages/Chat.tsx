import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Send, LogOut, Upload, Loader2, Bot, User as UserIcon, UserCircle } from "lucide-react";
import { Session } from "@supabase/supabase-js";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const Chat = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [dietId, setDietId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
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
        loadDietAndMessages(session.user.id);
      }
    });
  }, [navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadDietAndMessages = async (userId: string) => {
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

  const handleSend = async () => {
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

      if (error) throw error;

      if (data.error) {
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
    navigate("/auth");
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-white">
      <header className="border-b border-neutral-200 bg-white shrink-0">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center">
          <h1 className="text-lg sm:text-xl font-bold text-neutral-900">
            FoodTalk
          </h1>
          <div className="flex gap-2">
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
                  Estoy aquí para ayudarte con cualquier pregunta sobre tu plan nutricional. Puedo resolver dudas sobre porciones, sustituciones, horarios y mucho más.
                </p>
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
                    msg.role === "user" ? "flex justify-end" : ""
                  }`}
                >
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
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                    <UserIcon className="h-5 w-5 text-primary" />
                  </div>
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
        <div className="container mx-auto max-w-3xl flex gap-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu pregunta..."
            onKeyPress={(e) => e.key === "Enter" && !loading && handleSend()}
            disabled={loading}
            className="flex-1 text-base h-11 rounded-lg border-neutral-300 bg-neutral-50"
          />
          <Button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="bg-primary hover:bg-primary/90 text-white px-4 h-11 interactive"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </footer>
    </div>
  );
};

export default Chat;