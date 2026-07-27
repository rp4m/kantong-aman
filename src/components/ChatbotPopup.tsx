import { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Bot, User, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  useTransactions,
  useCategories,
  useBudgetPeriods,
  useBudgetItems,
  usePICs,
} from "@/lib/cloud-store";

export function ChatbotPopup() {
  const [isOpen, setIsOpen] = useState(false);

  // Data for context
  const transactions = useTransactions();
  const categories = useCategories();
  const budgetPeriods = useBudgetPeriods();
  const budgetItems = useBudgetItems();
  const pics = usePICs();

  const [messages, setMessages] = useState<{ role: "user" | "model", text: string }[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userMessage }]);
    setIsLoading(true);

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("API Key belum diset di VITE_GEMINI_API_KEY");
      }

      // Construct system context
      const contextData = {
        budgetPeriods: budgetPeriods.map(p => ({ id: p.id, name: p.name, start: p.startDate, end: p.endDate })),
        categories: categories.map(c => ({ id: c.id, name: c.name, type: c.type })),
        pics: pics.map(p => ({ id: p.id, name: p.name })),
        budgetItems: budgetItems.map(i => ({ categoryId: i.categoryId, picId: i.picId, amount: i.amount })),
        transactions: transactions.map(t => ({ date: t.date, type: t.type, amount: t.amount, category: t.category, notes: t.notes }))
      };

      const systemPrompt = `Anda adalah AI Assistant yang cerdas untuk aplikasi manajemen keuangan "Kantong Aman". 
Anda bertugas membantu pengguna menganalisis data keuangan mereka. 
Gunakan data JSON berikut sebagai referensi utama Anda (jangan tampilkan JSON ini ke pengguna, gunakan hanya untuk menjawab):
${JSON.stringify(contextData)}

Berikan jawaban yang ringkas, ramah, berbahasa Indonesia, dan langsung pada intinya. Jika memungkinkan, sajikan poin-poin agar mudah dibaca. Hindari menjelaskan teknis ID internal, fokus pada insight data.`;

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-3.6-flash",
        systemInstruction: systemPrompt
      });

      const history = messages.map(msg => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.text }]
      }));

      const chat = model.startChat({
        history: history,
      });

      const result = await chat.sendMessage(userMessage);
      const response = await result.response;
      const text = response.text();

      setMessages((prev) => [...prev, { role: "model", text }]);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [...prev, { role: "model", text: "Maaf, terjadi kesalahan: " + (error as Error).message }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([]);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-20 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 sm:bottom-6 sm:right-6",
          isOpen && "rotate-90 scale-0 opacity-0"
        )}
      >
        <MessageSquare className="h-6 w-6" />
      </button>

      <div
        className={cn(
          "fixed bottom-20 right-4 z-50 flex h-[500px] max-h-[75vh] w-[350px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl transition-all duration-300 sm:bottom-6 sm:right-6",
          isOpen ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
        )}
      >
        <div className="flex items-center justify-between bg-primary p-4 text-primary-foreground">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            <h3 className="font-semibold text-sm">AI Assistant</h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleClear}
              className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-primary-foreground/20 transition-colors"
              title="Bersihkan percakapan"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-primary-foreground/20 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/20 text-sm">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground opacity-70">
              <Bot className="mb-2 h-10 w-10 text-primary/50" />
              <p>Tanyakan sesuatu tentang data budget dan transaksi Anda.</p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex max-w-[85%] flex-col gap-1 rounded-2xl p-3 shadow-sm",
                  msg.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground rounded-br-sm"
                    : "mr-auto bg-card border border-border rounded-bl-sm"
                )}
              >
                <div className="flex items-center gap-1.5 mb-1 opacity-70 text-[10px] uppercase font-semibold">
                  {msg.role === "user" ? (
                    <><User className="h-3 w-3" /> Anda</>
                  ) : (
                    <><Bot className="h-3 w-3" /> AI</>
                  )}
                </div>
                <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="mr-auto max-w-[85%] rounded-2xl rounded-bl-sm bg-card border border-border p-4 shadow-sm">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60"></span>
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: "150ms" }}></span>
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: "300ms" }}></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-border bg-card p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tanya AI..."
              disabled={isLoading}
              className="flex-1 rounded-full bg-muted/50 focus-visible:ring-1 text-sm"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading}
              className="shrink-0 rounded-full h-9 w-9"
            >
              <Send className="h-4 w-4 ml-0.5" />
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
