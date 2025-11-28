import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Send, LogOut, Upload, Loader2, Bot, User } from "lucide-react";
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
    <div className="h-[100dvh] flex flex-col bg-gradient-to-br from-background via-secondary to-background">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm shrink-0">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex justify-between items-center">
          <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            FoodTalk
          </h1>
          <div className="flex gap-1 sm:gap-2">
            <Button 
              variant="outline" 
              onClick={() => navigate("/upload")} 
              size="sm"
              className="px-2 sm:px-3"
            >
              <Upload className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Subir nuevo plan</span>
            </Button>
            <Button 
              variant="outline" 
              onClick={handleLogout} 
              size="sm"
              className="px-2 sm:px-3"
            >
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-3 sm:p-4 min-h-0">
        <div className="container mx-auto max-w-3xl space-y-3 sm:space-y-4">
          {messages.length === 0 ? (
            <Card className="p-6 sm:p-8 text-center bg-gradient-to-br from-card to-secondary/20 border-border/50">
              <Bot className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 text-primary" />
              <h2 className="text-lg sm:text-xl font-semibold mb-2">¡Bienvenido a FoodTalk!</h2>
              <p className="text-sm sm:text-base text-muted-foreground">
                Hazme cualquier pregunta sobre tu plan nutricional
              </p>
            </Card>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-2 sm:gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  </div>
                )}
                <Card
                  className={`max-w-[85%] sm:max-w-[80%] p-3 sm:p-4 ${
                    msg.role === "user"
                      ? "bg-gradient-to-r from-primary to-accent text-primary-foreground border-none"
                      : "bg-card border-border/50"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                </Card>
                {msg.role === "user" && (
                  <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-accent/10 flex items-center justify-center">
                    <User className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
                  </div>
                )}
              </div>
            ))
          )}
          {loading && (
            <div className="flex gap-2 sm:gap-3 justify-start">
              <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <Card className="p-3 sm:p-4 bg-card border-border/50">
                <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin text-primary" />
              </Card>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      <footer className="border-t border-border/50 bg-card/50 backdrop-blur-sm p-3 sm:p-4 shrink-0 safe-bottom">
        <div className="container mx-auto max-w-3xl flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu pregunta..."
            onKeyPress={(e) => e.key === "Enter" && !loading && handleSend()}
            disabled={loading}
            className="flex-1 text-base"
          />
          <Button 
            onClick={handleSend} 
            disabled={loading || !input.trim()}
            className="px-3 sm:px-4"
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