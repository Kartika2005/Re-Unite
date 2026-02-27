import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import * as api from "../api";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Bot,
  User,
  MapPin,
  BarChart3,
  FileText,
  Search,
  Phone,
  Shield,
  Send,
  Loader2,
  X,
  Sparkles,
} from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface LocationSuggestion {
  formatted: string;
  lat: number;
  lng: number;
}

const GEOAPIFY_KEY = import.meta.env.VITE_GEOAPIFY_KEY || "";

const QUICK_ACTIONS = [
  { label: "Search by location", icon: MapPin, prompt: "/location ", auto: false },
  { label: "Case statistics", icon: BarChart3, prompt: "Show me the current case statistics and overview", auto: true },
  { label: "How to report", icon: FileText, prompt: "How do I report a missing person on Reunite?", auto: true },
  { label: "Search a case", icon: Search, prompt: "/search ", auto: false },
  { label: "Emergency contacts", icon: Phone, prompt: "Give me emergency helpline numbers", auto: true },
  { label: "Area safety check", icon: Shield, prompt: "/location ", auto: false },
];

function md(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-[0.85em]">$1</code>')
    .replace(/^### (.+)$/gm, '<div class="text-base font-bold mt-3 mb-1">$1</div>')
    .replace(/^## (.+)$/gm, '<div class="text-lg font-bold mt-3 mb-1">$1</div>')
    .replace(/^# (.+)$/gm, '<div class="text-xl font-bold mt-4 mb-1.5">$1</div>')
    .replace(/^- (.+)$/gm, '<div class="pl-4">• $1</div>')
    .replace(/^\d+\. (.+)$/gm, (m, p1) => `<div class="pl-4">${m[0]}. ${p1}</div>`)
    .replace(/\n/g, "<br>");
}

export function Chat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lng: number;
    name: string;
  } | null>(null);

  const messagesEnd = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query || query.length < 2 || !GEOAPIFY_KEY) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    try {
      const res = await fetch(
        `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(query)}&apiKey=${GEOAPIFY_KEY}&limit=5`
      );
      const data: any = await res.json();
      const list: LocationSuggestion[] = (data.features || []).map((f: any) => ({
        formatted: f.properties.formatted,
        lat: f.properties.lat,
        lng: f.properties.lon,
      }));
      setSuggestions(list);
      setShowDropdown(list.length > 0);
    } catch {
      setSuggestions([]);
      setShowDropdown(false);
    }
  }, []);

  const handleInputChange = (val: string) => {
    setInput(val);
    if (val.toLowerCase().startsWith("/location ")) {
      const q = val.slice(10).trim();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => fetchSuggestions(q), 300);
    } else {
      setShowDropdown(false);
      setSuggestions([]);
    }
  };

  const selectLocation = (s: LocationSuggestion) => {
    setSelectedLocation({ lat: s.lat, lng: s.lng, name: s.formatted });
    setInput(`/location ${s.formatted}`);
    setShowDropdown(false);
  };

  const sendMessage = async (overrideInput?: string) => {
    const text = (overrideInput ?? input).trim();
    if (!text || streaming) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);
    setShowDropdown(false);

    setMessages([...newMessages, { role: "assistant", content: "" }]);

    try {
      const loc =
        text.toLowerCase().startsWith("/location") && selectedLocation
          ? { latitude: selectedLocation.lat, longitude: selectedLocation.lng }
          : undefined;

      await api.sendChatMessage(
        newMessages.map((m) => ({ role: m.role, content: m.content })),
        loc,
        (fullText) => {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: "assistant", content: fullText };
            return updated;
          });
        }
      );
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        };
        return updated;
      });
    } finally {
      setStreaming(false);
      setSelectedLocation(null);
    }
  };

  const handleQuickAction = (action: (typeof QUICK_ACTIONS)[number]) => {
    if (action.auto) {
      sendMessage(action.prompt);
    } else {
      setInput(action.prompt);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-52px)] bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b bg-card">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-violet-500/20">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm">ReuniteAI Assistant</p>
          <p className="text-xs text-muted-foreground">Ask about cases, locations, statistics & more</p>
        </div>
        <Badge variant="outline" className="text-xs">
          {user?.role === "POLICE" ? "Police" : "Citizen"}
        </Badge>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="max-w-[800px] mx-auto px-5 py-5">
          {messages.length === 0 && (
            <div className="text-center pt-16">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-violet-500/10">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-bold mb-2">Welcome to ReuniteAI</h2>
              <p className="text-muted-foreground max-w-md mx-auto mb-8 text-sm leading-relaxed">
                I can help you search for cases by location, view statistics, learn
                how to report missing persons, and much more.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-lg mx-auto">
                {QUICK_ACTIONS.map((a, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    className="h-auto py-3 px-3 justify-start gap-2 text-xs font-normal hover:border-primary/50 transition-colors"
                    onClick={() => handleQuickAction(a)}
                  >
                    <a.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    {a.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex mb-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`flex gap-2.5 max-w-[80%] ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className={msg.role === "user" ? "bg-primary/10 text-primary" : "bg-violet-100 text-violet-600"}>
                    {msg.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                  </AvatarFallback>
                </Avatar>

                <div
                  className={`px-3.5 py-2.5 text-sm leading-relaxed break-words ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-[14px] rounded-br-sm"
                      : "bg-muted border rounded-[14px] rounded-bl-sm"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div dangerouslySetInnerHTML={{ __html: md(msg.content) }} />
                  ) : (
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  )}

                  {msg.role === "assistant" && streaming && i === messages.length - 1 && (
                    <span className="inline-block w-0.5 h-3.5 bg-primary ml-0.5 align-text-bottom animate-pulse" />
                  )}
                </div>
              </div>
            </div>
          ))}

          <div ref={messagesEnd} />
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="border-t bg-card px-5 py-3">
        <div className="max-w-[800px] mx-auto relative">
          {/* Location dropdown */}
          {showDropdown && suggestions.length > 0 && (
            <Card className="absolute bottom-full left-0 right-0 mb-1.5 overflow-hidden shadow-lg z-10">
              <div className="px-3 py-1.5 border-b text-xs text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-3 w-3" /> Select a location
              </div>
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => selectLocation(s)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2 transition-colors border-b last:border-b-0"
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{s.formatted}</span>
                </button>
              ))}
            </Card>
          )}

          {/* Selected location badge */}
          {selectedLocation && (
            <div className="mb-1.5 flex items-center gap-2">
              <Badge variant="secondary" className="gap-1.5 text-xs">
                <MapPin className="h-3 w-3" />
                {selectedLocation.name}
                <button
                  onClick={() => {
                    setSelectedLocation(null);
                    setInput("");
                  }}
                  className="ml-1 hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            </div>
          )}

          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={
                streaming
                  ? "Waiting for response..."
                  : 'Ask anything... (try "/location Mumbai" or "/search Rahul")'
              }
              disabled={streaming}
              className="flex-1"
            />
            <Button
              onClick={() => sendMessage()}
              disabled={!input.trim() || streaming}
              size="icon"
              className="shrink-0"
            >
              {streaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="mt-1.5 flex items-center gap-3 text-[0.7rem] text-muted-foreground">
            <span>Commands: <code className="text-foreground/70">/location</code> <code className="text-foreground/70">/search</code></span>
            <span>Press Enter to send</span>
          </div>
        </div>
      </div>
    </div>
  );
}
