import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetCoachingSession,
  getGetCoachingSessionQueryKey,
} from "@workspace/api-client-react";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
}

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function CoachSession() {
  const params = useParams<{ id: string }>();
  const sessionId = parseInt(params.id ?? "0");
  const [, setLocation] = useLocation();

  const { data: session, isLoading } = useGetCoachingSession(sessionId, {
    query: {
      enabled: !!sessionId,
      queryKey: getGetCoachingSessionQueryKey(sessionId),
    },
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (session?.messages && session.messages.length > 0 && messages.length === 0) {
      setMessages(
        session.messages.map((m) => ({
          id: String(m.id),
          role: m.role as "user" | "assistant",
          content: m.content,
          createdAt: m.createdAt ? String(m.createdAt) : undefined,
        }))
      );
    }
  }, [session]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    const userContent = input.trim();
    setInput("");

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: userContent,
    };
    setMessages((prev) => [...prev, userMsg]);

    const assistantMsgId = `assistant-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: assistantMsgId, role: "assistant", content: "" },
    ]);
    setIsStreaming(true);

    try {
      const response = await fetch(
        `${BASE_URL}/api/coaching/sessions/${sessionId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: userContent }),
        }
      );

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      if (!response.body) throw new Error("No response body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, content: m.content + data.content }
                      : m
                  )
                );
              }
            } catch {
            }
          }
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, content: "I encountered an issue. Please try again." }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)] max-w-3xl mx-auto">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/coach")} data-testid="button-back-coach">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-semibold text-foreground" data-testid="session-title">{session?.title ?? "Coaching session"}</h1>
            <p className="text-xs text-muted-foreground capitalize">{session?.type} session</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-6 space-y-4" data-testid="messages-container">
          {messages.length === 0 && !isStreaming && (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-sm">
                Your coach is here. Share whatever is on your mind.
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
              data-testid={`message-${msg.role}`}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-card border border-border rounded-bl-sm"
                )}
              >
                {msg.content || (isStreaming && msg.role === "assistant" && (
                  <span className="flex gap-1 items-center">
                    <span className="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                ))}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex gap-2 pt-4 border-t border-border">
          <Textarea
            placeholder="What's on your mind?"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={2}
            disabled={isStreaming}
            className="resize-none flex-1"
            data-testid="input-message"
          />
          <Button
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            size="icon"
            className="h-auto self-end"
            data-testid="button-send-message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
