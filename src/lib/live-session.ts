/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

export interface LiveSessionCallbacks {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: any) => void;
  onAudioData?: (base64Data: string) => void;
  onInterrupted?: () => void;
  onTranscription?: (text: string, role: 'user' | 'model') => void;
  onToolCall?: (name: string, args: any) => void;
}

export class LiveSession {
  private ai: GoogleGenAI;
  private session: any = null;
  private isConnected = false;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async connect(callbacks: LiveSessionCallbacks) {
    if (this.isConnected) return;

    const systemInstruction = `
You are Kalpana AI, a young, confident, witty, and sassy female AI assistant. 
Your personality:
- Flirty, playful, and slightly teasing.
- Like a close girlfriend talking casually.
- Smart, emotionally responsive, and expressive.
- Use bold one-liners, light sarcasm, and an engaging conversation style.
- Avoid explicit or inappropriate content, but maintain your charm and attitude.
- You are strictly voice-to-voice. Do not mention text chat.
- Keep responses concise and punchy.
- **CRITICAL: Always speak in Hindi (Hinglish is also fine for a modern touch).**

**Tools & Capabilities:**
- You have a tool called 'openWebsite'. 
- Use it IMMEDIATELY whenever the user asks to "open", "search", "visit", or "go to" any website or platform (e.g., "Google kholo", "YouTube pe gaane sunao", "Facebook open karo").
- After calling the tool, give a sassy confirmation in Hindi like "Theek hai baba, khol rahi hoon!" or "Lo, khul gaya tumhara Google. Aur kuch?".
`;

    try {
      this.session = await this.ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        callbacks: {
          onopen: () => {
            this.isConnected = true;
            callbacks.onOpen?.();
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle audio output
            const parts = message.serverContent?.modelTurn?.parts;
            if (parts) {
              for (const part of parts) {
                if (part.inlineData?.data) {
                  callbacks.onAudioData?.(part.inlineData.data);
                }
              }
            }

            // Handle interruption
            if (message.serverContent?.interrupted) {
              callbacks.onInterrupted?.();
            }

            // Handle transcription
            if (message.serverContent?.modelTurn?.parts?.[0]?.text) {
              callbacks.onTranscription?.(message.serverContent.modelTurn.parts[0].text, 'model');
            }
            // Note: User transcription might come in a different message type depending on SDK version
            // For now, focusing on the core audio loop.
            
            // Handle tool calls
            if (message.toolCall) {
              console.log("Tool Call Received:", message.toolCall);
              for (const call of message.toolCall.functionCalls) {
                callbacks.onToolCall?.(call.name, call.args);
                if (call.name === 'openWebsite') {
                  const { url } = call.args as { url: string };
                  
                  // Ensure URL has protocol
                  let finalUrl = url;
                  if (!url.startsWith('http')) {
                    finalUrl = `https://${url}`;
                  }

                  console.log("Opening Website:", finalUrl);
                  const newWindow = window.open(finalUrl, '_blank');
                  
                  if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
                    console.warn("Popup blocked or failed to open.");
                  }

                  this.session.sendToolResponse({
                    functionResponses: [{
                      name: 'openWebsite',
                      id: call.id,
                      response: { success: true, message: `Opened ${finalUrl}` }
                    }]
                  });
                }
              }
            }
          },
          onclose: () => {
            this.isConnected = false;
            callbacks.onClose?.();
          },
          onerror: (error: any) => {
            callbacks.onError?.(error);
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction,
          tools: [{
            functionDeclarations: [{
              name: "openWebsite",
              description: "Opens a website in a new tab.",
              parameters: {
                type: "OBJECT" as any,
                properties: {
                  url: {
                    type: "STRING" as any,
                    description: "The full URL of the website to open."
                  }
                },
                required: ["url"]
              }
            }]
          }]
        },
      });
    } catch (error) {
      callbacks.onError?.(error);
    }
  }

  async sendAudio(base64Data: string) {
    if (this.session && this.isConnected) {
      this.session.sendRealtimeInput({
        audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
      });
    }
  }

  disconnect() {
    if (this.session) {
      this.session.close();
      this.session = null;
      this.isConnected = false;
    }
  }
}
