"use client";

import { useState, useRef, useEffect } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SendHorizonal, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "./ui/card";

type Message = {
  id: number;
  text: string;
  sender: "user" | "ai";
};

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: "Welcome to BrandMonitorAI. How can I help?",
      sender: "ai",
    }
  ]);
  const [input, setInput] = useState("");
  const scrollViewportRef = useRef<HTMLDivElement>(null);

  const handleSendMessage = async () => {
    if (input.trim() === "") return;

    const userMessage: Message = {
      id: Date.now(),
      text: input,
      sender: "user",
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    // Simulate AI response
    const aiMessage: Message = {
        id: Date.now() + 1,
        text: `You said: "${userMessage.text}"`,
        sender: "ai",
    };

    setTimeout(() => {
        setMessages((prev) => [...prev, aiMessage]);
    }, 1000);
  };
  
  useEffect(() => {
    if (scrollViewportRef.current) {
        scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight;
    }
  }, [messages]);


  return (
    <div className="h-full flex flex-col p-4 md:p-6">
      <ScrollArea className="flex-1" viewportRef={scrollViewportRef}>
        <div className="space-y-4 py-4 max-w-4xl mx-auto w-full">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex items-start gap-3",
                message.sender === "user" ? "justify-end" : "justify-start"
              )}
            >
              {message.sender === "ai" && (
                <Avatar className="h-8 w-8 border bg-primary text-primary-foreground">
                   <AvatarFallback><Bot size={16}/></AvatarFallback>
                </Avatar>
              )}
              <div
                className={cn(
                  "max-w-[80%] rounded-lg p-3 text-sm",
                  message.sender === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                <p className="leading-relaxed">{message.text}</p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className="pt-4 max-w-4xl mx-auto w-full">
        <Card className="p-2">
            <div className="relative">
            <Input
                placeholder="Ask a question..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                className="pr-12 bg-background border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
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
        </Card>
      </div>
    </div>
  );
}
