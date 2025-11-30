"use client";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Message { role: "user" | "assistant"; content: string; }

export default function ChatBox() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages]);

  const send = async () => {
    if (!input.trim()) return;
    const userMessage: Message = { role: "user", content: input.trim() };
    const newMsgs: Message[] = [...messages, userMessage];
    setMessages(newMsgs);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/librechat/openai/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMsgs, model: "gpt-3.5-turbo" }),
      });
      
      if (!res.ok) {
        const errorText = await res.text().catch(() => "Unknown error");
        throw new Error(`HTTP error! status: ${res.status}, message: ${errorText}`);
      }

      // Read response body once
      const text = await res.text();
      
      // Check if response body is empty
      if (!text || text.trim() === "") {
        throw new Error("Empty response from server");
      }

      // Check content type
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`Expected JSON but got ${contentType || "no content-type"}. Response: ${text.substring(0, 100)}`);
      }

      // Parse JSON
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        throw new Error(`Invalid JSON response: ${text.substring(0, 200)}`);
      }

      const reply = data.choices?.[0]?.message?.content || data.message || "(no response)";
      const assistantMessage: Message = { role: "assistant", content: reply };
      setMessages([...newMsgs, assistantMessage]);
    } catch (error) {
      console.error("Failed to send message:", error);
      let errorMessage = "Failed to get response";
      
      if (error instanceof Error) {
        // Parse error message to provide user-friendly feedback
        if (error.message.includes("404") || error.message.includes("Not Found") || error.message.includes("Endpoint not found")) {
          errorMessage = "Backend endpoint not found. The backend server needs to be restarted to load the updated code. Please:\n1. Stop the backend server (Ctrl+C)\n2. Restart it: cd orchestration-backend/api && python main.py\n3. Wait for 'Application startup complete' message\n4. Try sending a message again";
        } else if (error.message.includes("401") || error.message.includes("Unauthorized")) {
          errorMessage = "Authentication failed. Please ensure the backend service is running and properly configured.";
        } else if (error.message.includes("503") || error.message.includes("Backend unavailable") || error.message.includes("timeout")) {
          errorMessage = "Backend service is not available. Please ensure the backend is running at http://localhost:8000";
        } else if (error.message.includes("Empty response")) {
          errorMessage = "Received an empty response from the server. The service may be unavailable.";
        } else {
          errorMessage = error.message;
        }
      }
      
      const errorResponseMessage: Message = { role: "assistant", content: `Error: ${errorMessage}` };
      setMessages([...newMsgs, errorResponseMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, i)=>(
          <div 
            key={i} 
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-xl p-3 rounded-lg ${
              m.role === 'user' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted'
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="max-w-xl p-3 rounded-lg bg-muted">
              <span className="animate-pulse">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>
      <div className="border-t p-4 flex gap-2 bg-card">
        <Textarea 
          value={input} 
          onChange={e=>setInput(e.target.value)} 
          onKeyDown={handleKeyDown}
          rows={2} 
          className="flex-1"
          placeholder="Type your message... "
        />
        <Button onClick={send} disabled={loading || !input.trim()}>Send</Button>
      </div>
    </div>
  );
}
