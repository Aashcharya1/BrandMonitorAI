"use client";

import { useState, useRef, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SendHorizonal } from "lucide-react";
import { cn } from "@/lib/utils";

type Message = {
  id: number;
  text: string;
  sender: "user" | "ai";
};

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: "Welcome to BrandGuardian. How can I assist you with your brand protection today?",
      sender: "ai",
    }
  ]);
  const [input, setInput] = useState("");
  const scrollViewportRef = useRef<HTMLDivElement>(null);

  const handleSendMessage = () => {
    if (input.trim() === "") return;

    const userMessage: Message = {
      id: Date.now(),
      text: input,
      sender: "user",
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    setTimeout(() => {
      const aiMessage: Message = {
        id: Date.now() + 1,
        text: "AI engine not connected in prototype mode.",
        sender: "ai",
      };
      setMessages((prev) => [...prev, aiMessage]);
    }, 1000);
  };

  useEffect(() => {
    if (scrollViewportRef.current) {
        scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight;
    }
  }, [messages]);


  return (
    <div className="flex h-[calc(100vh-8.5rem)] flex-col rounded-xl border bg-card shadow-sm">
      <ScrollArea className="flex-1 p-4" viewportRef={scrollViewportRef}>
        <div className="space-y-6 pr-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex items-start gap-3",
                message.sender === "user" && "justify-end"
              )}
            >
              {message.sender === "ai" && (
                <Avatar className="h-8 w-8 border">
                   <AvatarFallback>BG</AvatarFallback>
                </Avatar>
              )}
              <div
                className={cn(
                  "max-w-md rounded-lg p-3",
                  message.sender === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                <p className="leading-relaxed">{message.text}</p>
              </div>
               {message.sender === "user" && (
                <Avatar className="h-8 w-8 border">
                   <AvatarFallback>U</AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className="border-t bg-card p-4">
        <div className="relative">
          <Input
            placeholder="Ask about your brand protection status..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            className="pr-12"
          />
          <Button
            size="icon"
            variant="ghost"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={handleSendMessage}
            disabled={!input.trim()}
          >
            <SendHorizonal className="h-5 w-5" />
            <span className="sr-only">Send</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
