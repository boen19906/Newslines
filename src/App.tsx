import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Clock, 
  ExternalLink, 
  TrendingUp, 
  Globe, 
  RefreshCw, 
  AlertTriangle, 
  Brain, 
  CheckCircle, 
  XCircle, 
  FileText, 
  Mail, 
  Calendar,
  Play, 
  Pause, 
  Volume2, 
  Settings,
  MessageCircle,
  Bot,
  Loader,
  Send,
  User
} from 'lucide-react';
import './App.css';

// Replace with your actual Perplexity API key
const PERPLEXITY_API_KEY = '';

// API configuration
const API_BASE_URL = 'https://newslines-backend-fbccce3b78b9.herokuapp.com/api';

interface Headline {
  id: number;
  title: string;
  source: string;
  timestamp: string;
  category: string;
  link?: string;
  summary: string | null;
  priority?: number;
  summaryMetadata?: {
    sources: Array<{
      title: string;
      url: string;
      domain: string;
    }>;
    generatedAt: string;
    model: string;
  };
}

interface ApiResponse {
  success: boolean;
  sources?: string[];
  totalCount?: number;
  headlines: Headline[];
  timestamp: string;
  warnings?: string[];
  error?: string;
}

interface NewsletterData {
  content: string;
  topHeadlines: Headline[];
  generatedAt: string;
  model: string;
}

interface TTSState {
  isPlaying: boolean;
  isPaused: boolean;
  currentUtterance: SpeechSynthesisUtterance | null;
  currentText: string;
  playbackRate: number;
  voice: SpeechSynthesisVoice | null;
}

interface AudioControlsProps {
  text: string;
  isCompact?: boolean;
  className?: string;
}

// Helper function for source styling
const getSourceClass = (source: string) => {
  return source.toLowerCase().replace(/\s+/g, '-');
};

// Custom hook for Text-to-Speech
const useTextToSpeech = () => {
  const [ttsState, setTTSState] = useState<TTSState>({
    isPlaying: false,
    isPaused: false,
    currentUtterance: null,
    currentText: '',
    playbackRate: 1.0,
    voice: null
  });

  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    // Load available voices
    const loadVoices = () => {
      const voices = speechSynthesis.getVoices();
      setAvailableVoices(voices);
      
      // Set default voice (prefer English voices)
      const englishVoice = voices.find(voice => 
        voice.lang.startsWith('en') && voice.localService
      ) || voices[0];
      
      if (englishVoice) {
        setTTSState(prev => ({ ...prev, voice: englishVoice }));
      }
    };

    loadVoices();
    speechSynthesis.addEventListener('voiceschanged', loadVoices);

    return () => {
      speechSynthesis.removeEventListener('voiceschanged', loadVoices);
      speechSynthesis.cancel();
    };
  }, []);

  const cleanTextForSpeech = (text: string): string => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
      .replace(/\[(.*?)\]/g, '') // Remove bracketed references
      .replace(/\n{2,}/g, '. ') // Replace multiple newlines with periods
      .replace(/\n/g, ' ') // Replace single newlines with spaces
      .replace(/([.!?])\s*([A-Z])/g, '$1 $2') // Ensure proper spacing after sentences
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  };

  const speak = (text: string) => {
    // Stop any current speech
    speechSynthesis.cancel();

    const cleanedText = cleanTextForSpeech(text);
    const utterance = new SpeechSynthesisUtterance(cleanedText);

    // Configure utterance
    utterance.rate = ttsState.playbackRate;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    if (ttsState.voice) {
      utterance.voice = ttsState.voice;
    }

    // Event listeners
    utterance.onstart = () => {
      setTTSState(prev => ({
        ...prev,
        isPlaying: true,
        isPaused: false,
        currentUtterance: utterance,
        currentText: cleanedText
      }));
    };

    utterance.onend = () => {
      setTTSState(prev => ({
        ...prev,
        isPlaying: false,
        isPaused: false,
        currentUtterance: null,
        currentText: ''
      }));
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      setTTSState(prev => ({
        ...prev,
        isPlaying: false,
        isPaused: false,
        currentUtterance: null,
        currentText: ''
      }));
    };

    speechSynthesis.speak(utterance);
  };

  const pause = () => {
    if (speechSynthesis.speaking && !speechSynthesis.paused) {
      speechSynthesis.pause();
      setTTSState(prev => ({ ...prev, isPaused: true }));
    }
  };

  const resume = () => {
    if (speechSynthesis.paused) {
      speechSynthesis.resume();
      setTTSState(prev => ({ ...prev, isPaused: false }));
    }
  };

  const stop = () => {
    speechSynthesis.cancel();
    setTTSState(prev => ({
      ...prev,
      isPlaying: false,
      isPaused: false,
      currentUtterance: null,
      currentText: ''
    }));
  };

  const setPlaybackRate = (rate: number) => {
    setTTSState(prev => ({ ...prev, playbackRate: rate }));
    
    // If currently speaking, restart with new rate
    if (ttsState.isPlaying && ttsState.currentText) {
      stop();
      setTimeout(() => speak(ttsState.currentText), 100);
    }
  };

  const setVoice = (voice: SpeechSynthesisVoice) => {
    setTTSState(prev => ({ ...prev, voice }));
  };

  return {
    ...ttsState,
    availableVoices,
    speak,
    pause,
    resume,
    stop,
    setPlaybackRate,
    setVoice
  };
};

// Simplified AudioControls component with Listen/Pause toggle and Restart
const AudioControls: React.FC<AudioControlsProps> = ({ text, isCompact = false, className = '' }) => {
  const {
    isPlaying,
    isPaused,
    currentText,
    playbackRate,
    availableVoices,
    voice,
    speak,
    pause,
    resume,
    stop,
    setPlaybackRate,
    setVoice
  } = useTextToSpeech();

  const [showSettings, setShowSettings] = useState(false);
  const isCurrentText = currentText === text;

  const handlePlayPause = () => {
    if (isPlaying) {
      if (isPaused) {
        resume();
      } else {
        pause();
      }
    } else {
      speak(text);
    }
  };

  const handleRestart = () => {
    stop();
    setTimeout(() => speak(text), 100);
  };

  if (isCompact) {
    return (
      <div className={`audio-controls-compact ${className}`}>
        <button
          onClick={handlePlayPause}
          className="audio-btn primary"
          title={isPlaying ? (isPaused ? "Resume" : "Pause") : "Play"}
        >
          {isPlaying ? (
            isPaused ? <Play size={16} /> : <Pause size={16} />
          ) : (
            <Play size={16} />
          )}
        </button>
        
        {/* Show restart button when audio is playing */}
        {isPlaying && (
          <button
            onClick={handleRestart}
            className="audio-btn restart"
            title="Restart"
          >
            <RefreshCw size={16} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`audio-controls ${className}`}>
      <div className="audio-main-controls">
        <button
          onClick={handlePlayPause}
          className="audio-btn primary large"
          title={isPlaying ? (isPaused ? "Resume" : "Pause") : "Play Audio"}
        >
          {isPlaying ? (
            isPaused ? <Play size={20} /> : <Pause size={20} />
          ) : (
            <Play size={20} />
          )}
          <span className="audio-btn-text">
            {isPlaying ? (isPaused ? "Resume" : "Pause") : "Listen"}
          </span>
        </button>
        
        {/* Show restart button when audio is playing */}
        {isPlaying && (
          <button
            onClick={handleRestart}
            className="audio-btn restart"
            title="Restart Audio"
          >
            <RefreshCw size={16} />
            <span className="audio-btn-text">Restart</span>
          </button>
        )}

        <button
          onClick={() => setShowSettings(!showSettings)}
          className="audio-btn secondary"
          title="Audio Settings"
        >
          <Settings size={16} />
        </button>
      </div>

      {showSettings && (
        <div className="audio-settings">
          <div className="audio-setting">
            <label className="audio-setting-label">Speed:</label>
            <select
              value={playbackRate}
              onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
              className="audio-setting-select"
            >
              <option value="0.75">0.75x</option>
              <option value="1.0">1.0x</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
              <option value="2.0">2.0x</option>
            </select>
          </div>

          <div className="audio-setting">
            <label className="audio-setting-label">Voice:</label>
            <select
              value={voice?.name || ''}
              onChange={(e) => {
                const selectedVoice = availableVoices.find(v => v.name === e.target.value);
                if (selectedVoice) setVoice(selectedVoice);
              }}
              className="audio-setting-select"
            >
              {availableVoices
                .filter(voice => voice.lang.startsWith('en'))
                .map(voice => (
                  <option key={voice.name} value={voice.name}>
                    {voice.name} ({voice.lang})
                  </option>
                ))}
            </select>
          </div>
        </div>
      )}

      {isPlaying && isCurrentText && (
        <div className="audio-status">
          <div className="audio-wave">
            <div className="wave-bar"></div>
            <div className="wave-bar"></div>
            <div className="wave-bar"></div>
          </div>
          <span className="audio-status-text">
            {isPaused ? 'Paused' : 'Playing'} at {playbackRate}x speed
          </span>
        </div>
      )}
    </div>
  );
};

// Headline Card Component
const HeadlineCard: React.FC<{
  headline: Headline;
  onSummarize: (id: number) => void;
  isGenerating: boolean;
}> = ({ headline, onSummarize, isGenerating }) => {
  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger if clicking on audio controls or external link
    if ((e.target as HTMLElement).closest('.audio-controls-compact, .external-link-btn')) {
      return;
    }
    onSummarize(headline.id);
  };

  const handleLinkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (headline.link) {
      window.open(headline.link, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="headline-card hover-lift" onClick={handleCardClick}>
      <div className="headline-card-content">
        <div className="headline-header">
          <span className={`category-tag ${headline.category.toLowerCase()}`}>
            {headline.category}
          </span>
          <div className="timestamp">
            <Clock className="icon-sm" />
            {headline.timestamp}
          </div>
        </div>
        
        <h2 className="headline-title">
          {headline.title}
        </h2>
        
        <div className="headline-footer">
          <div className={`source ${getSourceClass(headline.source)}`}>
            <Globe className="icon-sm" />
            {headline.source}
          </div>
          
          <div className="summary-actions">
            {headline.link && (
              <button
                onClick={handleLinkClick}
                className="external-link-btn"
                title="Read full article"
              >
                <ExternalLink className="icon-sm" />
              </button>
            )}
            
            <div className={`summary-action ${isGenerating ? 'generating' : ''} ${headline.summary ? 'has-summary' : ''}`}>
              {isGenerating ? (
                <>
                  <div className="spinner"></div>
                  Researching...
                </>
              ) : headline.summary ? (
                <>
                  <CheckCircle className="icon-sm" />
                  View Summary
                </>
              ) : (
                <>
                  <Brain className="icon-sm" />
                  AI Research
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


// Types for chat messages
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: Array<{
    title: string;
    url: string;
    domain: string;
  }>;
}

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
}

const SummaryModal: React.FC<{
  headline: Headline | null;
  onClose: () => void;
  isGenerating: boolean;
  error: string | null;
}> = ({ headline, onClose, isGenerating, error }) => {
  const [showAudioControls, setShowAudioControls] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatState, setChatState] = useState<ChatState>({
    messages: [],
    isLoading: false
  });
  
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [chatState.messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (showChat && chatInputRef.current) {
      chatInputRef.current.focus();
    }
  }, [showChat]);

  // Load chat context from sessionStorage when headline changes
  useEffect(() => {
    if (headline?.id) {
      const savedChat = sessionStorage.getItem(`chat_context_${headline.id}`);
      if (savedChat) {
        try {
          const parsed = JSON.parse(savedChat);
          setChatState({
            messages: parsed.messages.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            })),
            isLoading: false
          });
        } catch (e) {
          console.error('Failed to load chat context:', e);
        }
      } else {
        setChatState({ messages: [], isLoading: false });
      }
    }
  }, [headline?.id]);

  // Save chat context to sessionStorage
  const saveChatContext = (messages: ChatMessage[]) => {
    if (headline?.id) {
      sessionStorage.setItem(`chat_context_${headline.id}`, JSON.stringify({
        messages,
        lastUpdated: new Date().toISOString()
      }));
    }
  };

  const generateChatResponse = async (userMessage: string) => {
    // Early validation
    if (!headline) {
      console.error('No headline available');
      return;
    }
  
    if (!userMessage.trim()) {
      console.error('Empty user message');
      return;
    }
  
    const newUserMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage.trim(),
      timestamp: new Date()
    };
  
    const assistantMessageId = (Date.now() + 1).toString();
    // Only add user message initially, don't create empty assistant message
    const updatedMessages = [...chatState.messages, newUserMessage];
    setChatState({
      messages: updatedMessages,
      isLoading: true
    });
  
    try {
      // Build conversation context
      const systemPrompt = `You are a helpful research assistant discussing: "${headline.title}"
  
  Context: ${headline.summary || 'No summary available.'}
  
  Guidelines:
  - Keep responses under 80 words and conversational
  - Use **bold** for key information
  - Use *italics* for emphasis  
  - Be direct and concise
  - No citation numbers in your response`;
  
      const conversationMessages = [
        { role: 'system', content: systemPrompt },
        // Include last 6 messages for context (excluding the empty assistant message)
        ...chatState.messages.slice(-6).map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        { role: 'user', content: userMessage }
      ];
  
      console.log('Sending request to Perplexity API...');
  
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'sonar',
          messages: conversationMessages,
          max_tokens: 150,
          temperature: 0.3,
          return_citations: true,
          stream: false
        })
      });
  
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        throw new Error(`API request failed: ${response.status}`);
      }
  
      // Handle non-streaming response
      const data = await response.json();
      console.log('API Response:', data);
  
      const content = data.choices?.[0]?.message?.content || '';
      const citations = data.citations || [];
  
      if (!content.trim()) {
        throw new Error('No content received from API');
      }
  
      console.log('Raw content:', content);
  
      // Clean content
      const finalContent = cleanContent(content);
      console.log('Final content:', finalContent);
  
      // Create assistant message
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: finalContent,
        timestamp: new Date(),
        sources: citations
      };
  
      // Update state with final message
      const finalMessages = [...updatedMessages, assistantMessage];
      setChatState({
        messages: finalMessages,
        isLoading: false
      });
  
      // Save to storage
      saveChatContext(finalMessages);
      
      console.log('Chat response completed successfully');
  
    } catch (error) {
      console.error('Chat generation error:', error);
      
      // Show user-friendly error message
      const errorMessage = error instanceof Error 
        ? `Error: ${error.message}` 
        : 'Something went wrong. Please try again.';
  
      setChatState(prevState => ({
        ...prevState,
        messages: prevState.messages.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, content: errorMessage }
            : msg
        ),
        isLoading: false
      }));
    }
  };
  
  // Simplified content cleaning function
  const cleanContent = (rawContent: string): string => {
    if (!rawContent) return '';
  
    return rawContent
      // Remove citation brackets [1], [2], etc.
      .replace(/\[\d+\]/g, '')
      // Remove citation ranges [1-3], [1,2,3]
      .replace(/\[[\d\s,\-]+\]/g, '')
      // Remove thinking tags
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      // Clean up multiple spaces
      .replace(/\s{2,}/g, ' ')
      // Clean up multiple newlines
      .replace(/\n{3,}/g, '\n\n')
      // Remove leading/trailing whitespace
      .trim();
  };
  

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatState.isLoading) return;

    const message = chatInput.trim();
    setChatInput('');
    await generateChatResponse(message);
  };

  const clearChatHistory = () => {
    if (headline?.id) {
      sessionStorage.removeItem(`chat_context_${headline.id}`);
    }
    setChatState({ messages: [], isLoading: false });
  };

  if (!headline) return null;

  // Helper function to convert markdown bold and italic to JSX
  const renderTextWithFormatting = (text: string) => {
    // Split by both bold (**) and italic (*) patterns
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        // Bold text
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      } else if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
        // Italic text (single asterisk, not double)
        return <em key={index}>{part.slice(1, -1)}</em>;
      }
      return part;
    });
  };

  const formatSummary = (text: string) => {
    let cleanText = text
      .replace(/\[\d+\]/g, '')
      // Remove the line that strips bold markdown: .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/^[\*\-•]\s+/gm, '')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^[\d]+\.\s+/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const paragraphs = cleanText
      .split(/\n\n+/)
      .map(p => p.replace(/\s+/g, ' ').trim())
      .filter(p => p.length > 50)
      .slice(0, 3);

    return paragraphs.map((paragraph, index) => (
      <p key={index} className="summary-paragraph">
        {renderTextWithFormatting(paragraph)}
      </p>
    ));
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-section">
            <div>
              <h1 className="modal-title">
                {headline.title}
              </h1>
              <div className="modal-meta">
                <div className="modal-source">
                  <Globe className="icon-sm" />
                  {headline.source}
                </div>
                <div className="modal-timestamp">
                  <Clock className="icon-sm" />
                  {headline.timestamp}
                </div>
                {headline.link && (
                  <a
                    href={headline.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="modal-external-link"
                  >
                    <ExternalLink className="icon-sm" />
                    Read Original
                  </a>
                )}
              </div>
            </div>
            <button onClick={onClose} className="close-button">
              <svg className="icon-md" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        <div className="modal-body">
          {isGenerating ? (
            <div className="modal-loading">
              <div className="spinner-large"></div>
              <h3>AI is researching this story...</h3>
              <p>Analyzing multiple sources and generating comprehensive summary</p>
              <div className="loading-steps">
                <div className="loading-step active">
                  <CheckCircle className="icon-sm" />
                  Searching news sources
                </div>
                <div className="loading-step active">
                  <div className="spinner-sm"></div>
                  Analyzing information
                </div>
                <div className="loading-step">
                  <div className="spinner-sm"></div>
                  Generating summary
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="modal-error">
              <XCircle className="error-icon" />
              <h3>Unable to Generate Summary</h3>
              <p className="error-message">{error}</p>
              <button className="retry-button" onClick={() => window.location.reload()}>
                <RefreshCw className="icon-sm" />
                Try Again
              </button>
            </div>
          ) : headline.summary ? (
            <div className="summary-content">
              {/* AI Notice */}
              <div className="ai-notice">
                <div className="ai-notice-icon">
                  <Brain className="icon-sm" />
                </div>
                <div className="ai-notice-text">
                  <p>
                    <strong>AI-Generated Research Summary</strong>
                    {headline.summaryMetadata && (
                      <span className="ai-meta">
                        Generated {new Date(headline.summaryMetadata.generatedAt).toLocaleString()} • {headline.summaryMetadata.model}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Audio Controls */}
              <div className="modal-audio-section">
                <div 
                  className={`audio-section-toggle ${showAudioControls ? 'expanded' : ''}`}
                  onClick={() => setShowAudioControls(!showAudioControls)}
                >
                  <Volume2 className="icon-sm" />
                  <span>Listen to Summary</span>
                  <div className="audio-toggle-icon" style={{ marginLeft: 'auto' }}>
                    <svg className="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
                
                {showAudioControls && (
                  <div className="audio-controls-wrapper">
                    <AudioControls 
                      text={headline.summary} 
                      className="summary-audio"
                    />
                  </div>
                )}
              </div>

              {/* Summary Text */}
              <div className="summary-text">
                {formatSummary(headline.summary)}
              </div>

              {/* Chat Toggle */}
              <div className="modal-chat-section">
                <div 
                  className={`chat-section-toggle ${showChat ? 'expanded' : ''}`}
                  onClick={() => setShowChat(!showChat)}
                >
                  <MessageCircle className="icon-sm" />
                  <span>Ask Follow-up Questions</span>
                  {chatState.messages.length > 0 && (
                    <span className="chat-message-count">({chatState.messages.filter(m => m.role === 'user').length})</span>
                  )}
                  <div className="chat-toggle-icon" style={{ marginLeft: 'auto' }}>
                    <svg className="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
                
                {showChat && (
                  <div className="chat-wrapper">
                    {chatState.messages.length > 0 && (
                      <div className="chat-header">
                        <span className="chat-context-info">Conversation about this story</span>
                        <button 
                          onClick={clearChatHistory}
                          className="clear-chat-button"
                          title="Clear conversation history"
                        >
                          <RefreshCw className="icon-xs" />
                        </button>
                      </div>
                    )}
                    
                    <div className="chat-messages" ref={chatMessagesRef}>
                      {chatState.messages.length === 0 ? (
                        <div className="chat-placeholder">
                          <MessageCircle className="icon-md opacity-50" />
                          <p>Ask any follow-up questions about this story. I'll remember our conversation!</p>
                          <div className="suggested-questions">
                            <button 
                              onClick={() => setChatInput("What are the key implications of this?")}
                              className="suggested-question"
                            >
                              What are the key implications?
                            </button>
                            <button 
                              onClick={() => setChatInput("What's the background context?")}
                              className="suggested-question"
                            >
                              What's the background?
                            </button>
                            <button 
                              onClick={() => setChatInput("Who are the main people involved?")}
                              className="suggested-question"
                            >
                              Who's involved?
                            </button>
                          </div>
                        </div>
                      ) : (
                        chatState.messages.map((message) => (
                          <div key={message.id} className={`chat-message ${message.role}`}>
                            <div className="message-header">
                              {message.role === 'user' ? (
                                <User className="icon-sm" />
                              ) : (
                                <Bot className="icon-sm" />
                              )}
                              <span className="message-time">
                                {message.timestamp.toLocaleTimeString()}
                              </span>
                            </div>
                            <div className="message-content">
                              {renderTextWithFormatting(message.content)}
                            </div>
                            {message.sources && message.sources.length > 0 && (
                              <div className="message-sources">
                                <span className="sources-label">Sources:</span>
                                {message.sources.map((source, idx) => (
                                  <a 
                                    key={idx}
                                    href={source.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="message-source-link"
                                  >
                                    {source.domain}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                      
                      {chatState.isLoading && (
                        <div className="chat-message assistant">
                          <div className="message-header">
                            <Bot className="icon-sm" />
                            <span className="message-time">Now</span>
                          </div>
                          <div className="message-content">
                            <div className="typing-indicator">
                              <Loader className="icon-sm animate-spin" />
                              Thinking...
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <form onSubmit={handleChatSubmit} className="chat-input-form">
                      <input
                        ref={chatInputRef}
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Ask a follow-up question..."
                        className="chat-input"
                        disabled={chatState.isLoading}
                      />
                      <button 
                        type="submit" 
                        className="chat-send-button"
                        disabled={!chatInput.trim() || chatState.isLoading}
                      >
                        <Send className="icon-sm" />
                      </button>
                    </form>
                  </div>
                )}
              </div>
              
              {/* Sources Section */}
              {headline.summaryMetadata?.sources && headline.summaryMetadata.sources.length > 0 ? (
                <div className="sources-section">
                  <h3 className="sources-title">
                    <ExternalLink className="icon-sm" />
                    Sources Referenced by AI
                  </h3>
                  <div className="sources-list">
                    {headline.summaryMetadata.sources.map((source, index) => (
                      <div key={index} className="source-item">
                        <div className="source-info">
                          <div className="source-title">{source.title}</div>
                          <div className="source-domain">{source.domain}</div>
                        </div>
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="source-link"
                        >
                          <ExternalLink className="icon-sm" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="sources-note">
                  <ExternalLink className="icon-sm" />
                  Sources analyzed by AI but not directly available for linking
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state">
              <Brain className="empty-state-icon" />
              <h3>AI Research Available</h3>
              <p>Click anywhere on the card to generate a comprehensive AI summary of this story with multiple sources.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Newsletter Modal Component with Collapsible Audio
const NewsletterModal: React.FC<{
  newsletter: NewsletterData | null;
  onClose: () => void;
  isGenerating: boolean;
  error: string | null;
}> = ({ newsletter, onClose, isGenerating, error }) => {
  const [showAudioControls, setShowAudioControls] = useState(false); // Add this state
  
  const formatNewsletterContent = (content: string) => {
    // Helper function to convert markdown bold and italic to JSX
    const renderTextWithFormatting = (text: string) => {
      // Split by both bold (**) and italic (*) patterns
      const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
      
      return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          // Bold text
          return <strong key={index}>{part.slice(2, -2)}</strong>;
        } else if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
          // Italic text (single asterisk, not double)
          return <em key={index}>{part.slice(1, -1)}</em>;
        }
        return part;
      });
    };
  
    const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);
    return paragraphs.map((paragraph, index) => (
      <p key={index} className="newsletter-paragraph">
        {renderTextWithFormatting(paragraph.trim())}
      </p>
    ));
  };
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <div className="modal-title-section">
            <div>
              <h1 className="modal-title">
                <Mail className="icon-md" />
                Daily News Brief
              </h1>
              <div className="modal-meta">
                <div className="modal-timestamp">
                  <Calendar className="icon-sm" />
                  {new Date().toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </div>
                {newsletter && (
                  <div className="modal-source">
                    <Brain className="icon-sm" />
                    Generated by AI • {newsletter.model}
                  </div>
                )}
              </div>
            </div>
            <button onClick={onClose} className="close-button">
              <svg className="icon-md" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        <div className="modal-body">
          {isGenerating ? (
            <div className="modal-loading">
              <div className="spinner-large"></div>
              <h3>Generating your daily news brief...</h3>
              <p>AI is analyzing today's top headlines and creating a comprehensive summary</p>
              <div className="loading-steps">
                <div className="loading-step active">
                  <CheckCircle className="icon-sm" />
                  Analyzing headlines
                </div>
                <div className="loading-step active">
                  <div className="spinner-sm"></div>
                  Creating brief
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="modal-error">
              <XCircle className="error-icon" />
              <h3>Unable to Generate Newsletter</h3>
              <p className="error-message">{error}</p>
              <button className="retry-button" onClick={() => window.location.reload()}>
                <RefreshCw className="icon-sm" />
                Try Again
              </button>
            </div>
          ) : newsletter ? (
            <div className="newsletter-content">
              {/* Compact AI notice */}
              <div className="ai-notice">
                <div className="ai-notice-icon">
                  <Brain className="icon-sm" />
                </div>
                <div className="ai-notice-text">
                  <p>
                    <strong>AI-Generated Daily News Brief</strong>
                    <span className="ai-meta">
                      • Generated {new Date(newsletter.generatedAt).toLocaleString()}
                      • Powered by {newsletter.model}
                    </span>
                  </p>
                </div>
              </div>

              {/* Collapsible Audio Controls - Same as Summary Modal */}
              <div className="modal-audio-section">
                <div 
                  className={`audio-section-toggle ${showAudioControls ? 'expanded' : ''}`}
                  onClick={() => setShowAudioControls(!showAudioControls)}
                >
                  <Volume2 className="icon-sm" />
                  <span>Listen to Newsletter</span>
                  <div className="audio-toggle-icon" style={{ marginLeft: 'auto' }}>
                    <svg 
                      className="icon-sm" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                      style={{ 
                        transform: showAudioControls ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease'
                      }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
                
                {showAudioControls && (
                  <div className="audio-controls-wrapper">
                    <AudioControls 
                      text={newsletter.content} 
                      className="newsletter-audio"
                    />
                  </div>
                )}
              </div>
              
              {/* PROMINENT NEWSLETTER TEXT */}
              <div className="newsletter-text">
                {formatNewsletterContent(newsletter.content)}
              </div>
              
              {newsletter.topHeadlines.length > 0 && (
                <div className="featured-headlines">
                  <h3 className="featured-headlines-title">
                    <TrendingUp className="icon-sm" />
                    Featured Headlines
                  </h3>
                  <div className="featured-headlines-list">
                    {newsletter.topHeadlines.map((headline, index) => (
                      <div key={headline.id} className="featured-headline-item">
                        <div className="featured-headline-content">
                          <div className="featured-headline-number">
                            {index + 1}
                          </div>
                          <div className="featured-headline-details">
                            <h4 className="featured-headline-title">
                              {headline.title}
                            </h4>
                            <div className="featured-headline-meta">
                              <span className="featured-headline-source">
                                <Globe className="icon-sm" />
                                {headline.source}
                              </span>
                              <span className="featured-headline-time">
                                <Clock className="icon-sm" />
                                {headline.timestamp}
                              </span>
                              <span className="featured-headline-category">
                                {headline.category}
                              </span>
                            </div>
                          </div>
                          {headline.link && (
                            <a
                              href={headline.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="featured-headline-link"
                            >
                              <ExternalLink className="icon-sm" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state">
              <FileText className="empty-state-icon" />
              <h3>Ready to Generate Newsletter</h3>
              <p>AI will analyze today's top headlines and create a comprehensive daily news brief for you.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Main App Component
const App: React.FC = () => {
  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [selectedHeadline, setSelectedHeadline] = useState<Headline | null>(null);
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  
  // Newsletter state
  const [showNewsletter, setShowNewsletter] = useState(false);
  const [newsletter, setNewsletter] = useState<NewsletterData | null>(null);
  const [generatingNewsletter, setGeneratingNewsletter] = useState(false);
  const [newsletterError, setNewsletterError] = useState<string | null>(null);

  // Available sources and categories
  const sources = ['All Sources', 'CNN', 'Fox News', 'NBC News'];
  const categories = ['All Categories', 'Politics', 'World', 'Business', 'Technology', 'Health', 'Environment', 'Sports', 'General'];

  // Fetch headlines from API
  useEffect(() => {
    fetchHeadlines();
  }, []);

  const fetchHeadlines = async () => {
    try {
      setLoading(true);
      setError(null);
      setWarnings([]);
      
      const response = await fetch(`${API_BASE_URL}/headlines`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch headlines: ${response.status}`);
      }
      
      const data: ApiResponse = await response.json();
      
      if (data.success && data.headlines) {
        setHeadlines(data.headlines);
        setLastUpdated(new Date().toLocaleTimeString());
        
        if (data.warnings && data.warnings.length > 0) {
          setWarnings(data.warnings);
        }
      } else {
        throw new Error(data.error || 'Failed to load headlines');
      }
      
    } catch (err) {
      console.error('Error fetching headlines:', err);
      setError(err instanceof Error ? err.message : 'Failed to load headlines');
      
      // Fallback to mock data if API fails
      const mockHeadlines: Headline[] = [
        {
          id: 1,
          title: "Breaking: Major political development shakes Washington as new legislation passes",
          source: "CNN",
          timestamp: "2 hours ago",
          category: "Politics",
          summary: null,
          link: "https://cnn.com/example",
          priority: 100
        },
        {
          id: 2,
          title: "Global climate summit reaches unprecedented agreement on carbon reduction targets",
          source: "NBC News", 
          timestamp: "4 hours ago",
          category: "Environment",
          summary: null,
          link: "https://nbcnews.com/example",
          priority: 95
        },
        {
          id: 3,
          title: "Technology giants announce breakthrough in artificial intelligence research capabilities",
          source: "Fox News",
          timestamp: "6 hours ago", 
          category: "Technology",
          summary: null,
          link: "https://foxnews.com/example",
          priority: 90
        },
        {
          id: 4,
          title: "World markets surge following unexpected economic growth in major economies",
          source: "CNN",
          timestamp: "8 hours ago",
          category: "Business",
          summary: null,
          link: "https://cnn.com/business-example",
          priority: 85
        },
        {
          id: 5,
          title: "Health officials announce new treatment shows promising results in clinical trials",
          source: "NBC News",
          timestamp: "10 hours ago",
          category: "Health",
          summary: null,
          link: "https://nbcnews.com/health-example",
          priority: 80
        }
      ];
      setHeadlines(mockHeadlines);
      
    } finally {
      setLoading(false);
    }
  };

  // Filter headlines based on search, source, and category
  const filteredHeadlines = headlines.filter(headline => {
    const matchesSearch = headline.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         headline.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         headline.source.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSource = selectedSource === 'all' || 
                         selectedSource === 'All Sources' || 
                         headline.source === selectedSource;
    
    const matchesCategory = selectedCategory === 'all' || 
                           selectedCategory === 'All Categories' || 
                           headline.category === selectedCategory;
    
    return matchesSearch && matchesSource && matchesCategory;
  });

  const generateSummaryWithPerplexity = async (headline: Headline) => {
    const prompt = `Write a clear, readable summary about: "${headline.title}"

Structure it as exactly 3 paragraphs:
1. Basic summary - What happened (the key facts)
2. Context/Background - Brief relevant background information  
3. Significance - Why this matters or is important

Keep each paragraph 2-4 sentences. Total length: 150-200 words. 

FORMATTING INSTRUCTIONS:
- Use **bold** for important names of people, organizations, companies, and key figures
- Use **bold** for critical numbers, dates, amounts, and statistics
- Use **bold** for important places, locations, and geographic names
- Use **bold** for key terms, concepts, and significant events
- Use *italics* for emphasis on important actions or outcomes
- Use plain language, no bullet points or lists

Example formatting: **President Biden** announced that **$50 billion** will be allocated to **climate initiatives** in **California**, which *significantly impacts* the **2024 election** strategy.`;

    const modelsToTry = [
      'sonar',
      'sonar-reasoning'
    ];

    for (const model of modelsToTry) {
      try {
        console.log(`Trying model: ${model}`);
        
        const requestBody = {
          model: model,
          messages: [
            {
              role: 'system',
              content: 'You are a helpful research assistant that provides comprehensive, well-sourced news summaries. Always cite your sources and provide balanced perspectives. Format important information using markdown bold (**) and italics (*) as instructed.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 350,
          temperature: 0.2,
          return_citations: true
        };

        const response = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        const responseText = await response.text();

        if (response.ok) {
          const data = JSON.parse(responseText);
          console.log(`✅ Success with model: ${model}`);
          return data;
        } else {
          console.log(`❌ Failed with model ${model}: ${response.status} - ${responseText}`);
          
          if (model === modelsToTry[modelsToTry.length - 1]) {
            let errorMessage = `Perplexity API error: ${response.status}`;
            try {
              const errorData = JSON.parse(responseText);
              if (errorData.error) {
                errorMessage += ` - ${errorData.error.message || errorData.error}`;
              }
            } catch (e) {
              errorMessage += ` - ${responseText}`;
            }
            throw new Error(errorMessage);
          }
        }
      } catch (error) {
        console.error(`Error with model ${model}:`, error);
        
        if (model === modelsToTry[modelsToTry.length - 1]) {
          throw error;
        }
        
        continue;
      }
    }
  };

  const generateNewsletter = async () => {
    setGeneratingNewsletter(true);
    setNewsletterError(null);
  
    try {
      // Filter for high-priority headlines across important categories
      const getImportantHeadlines = (headlines: Headline[]) => {
        // Categories that are typically important for national news
        const importantCategories = ['Politics', 'World', 'Business', 'Technology', 'Health', 'Environment'];
  
        return headlines.filter(headline => {
          const categoryMatch = importantCategories.includes(headline.category);
          const hasHighPriority = (headline.priority || 0) >= 70;
          
          return hasHighPriority && categoryMatch;
        });
      };
  
      // Get important headlines first
      const importantHeadlines = getImportantHeadlines(headlines);
      
      // Sort by priority and take top 12 for AI analysis
      const topHeadlines = importantHeadlines
        .sort((a, b) => (b.priority || 0) - (a.priority || 0))
        .slice(0, 12);
  
      // If we don't have enough headlines, fall back to all headlines
      const headlinesToUse = topHeadlines.length >= 3 ? topHeadlines : 
        headlines.sort((a, b) => (b.priority || 0) - (a.priority || 0)).slice(0, 12);
  
      const headlinesList = headlinesToUse.map((h, i) => 
        `${i + 1}. "${h.title}" - ${h.source} (${h.category})`
      ).join('\n');
  
      const newsletterPrompt = `You are writing "The Daily Brief" - a concise, authoritative news summary. Analyze these headlines and create a focused daily news brief covering the 3 MOST IMPORTANT stories of the day:

${headlinesList}

Your task: Select the 3 most significant stories based purely on IMPORTANCE and IMPACT - not category diversity. Choose what actually matters most today.

STRUCTURE:
**Opening Hook (1 paragraph):** Brief overview of today's most important developments.

**[Short headline - 3-5 words]**
One paragraph (4-6 sentences) on the most important story of the day.

**[Short headline - 3-5 words]** 
One paragraph (4-6 sentences) on the second most important story.

**[Short headline - 3-5 words]**
One paragraph (4-6 sentences) on the third most important story.

**The Bottom Line (1 paragraph):** What these stories mean going forward.

CRITICAL RULES:
- Headlines must be SHORT (3-5 words) and describe the actual news, NOT categories
- Choose stories by IMPORTANCE, not to hit different categories
- Use **bold** for names, places, numbers, dates, companies, key terms
- NO category labels like "Economy:" or "Politics:" - just the news
- Maximum 600 words total
- Focus on stories that actually matter to people's lives

GOOD headline examples:
"**Fed Cuts Rates**"
"**Trump Indicted Again**" 
"**Meta Layoffs Announced**"
"**Ukraine Aid Approved**"

BAD examples (DO NOT DO):
"**Economy: Fed Moves on Rates**"
"**Politics: Trump Legal Issues**"
"**Technology: Meta Job Cuts**"

Choose the 3 biggest stories of the day, period. Don't force diversity if the top 3 stories happen to be similar topics.`;
  
      const modelsToTry = ['sonar-pro', 'sonar', 'sonar-reasoning'];
  
      let newsletterData: any = null;
  
      for (const model of modelsToTry) {
        try {
          const requestBody = {
            model: model,
            messages: [
              {
                role: 'system',
                content: 'You are a news editor focused on identifying the most important stories of the day based on actual impact and significance to readers. You prioritize major breaking news, significant policy changes, market-moving events, and stories that affect people\'s daily lives. You do NOT force category diversity - if the 3 biggest stories are all political, so be it. Your job is to pick what actually matters most, not to create artificial balance.'
              },
              {
                role: 'user',
                content: newsletterPrompt
              }
            ],
            max_tokens: 1000,
            temperature: 0.4,
            return_citations: true
          };
  
          const response = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
          });
  
          if (response.ok) {
            newsletterData = await response.json();
            break;
          }
        } catch (error) {
          if (model === modelsToTry[modelsToTry.length - 1]) {
            throw error;
          }
          continue;
        }
      }
  
      if (!newsletterData) {
        throw new Error('Failed to generate newsletter with all available models');
      }
  
      // Enhanced smart selection of diverse featured headlines
      const getSmartFeaturedHeadlines = (headlines: Headline[]) => {
        // Prioritize category diversity first
        const categoryPriority = ['Politics', 'World', 'Business', 'Technology', 'Health', 'Environment'];
        const diverseHeadlines: Headline[] = [];
        const usedCategories = new Set<string>();
        
        // Sort by priority first
        const sortedHeadlines = [...headlines].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  
        // First pass: Select one headline from each major category
        for (const category of categoryPriority) {
          const categoryHeadline = sortedHeadlines.find(h => 
            h.category === category && !usedCategories.has(h.category)
          );
          
          if (categoryHeadline && diverseHeadlines.length < 4) {
            diverseHeadlines.push(categoryHeadline);
            usedCategories.add(categoryHeadline.category);
          }
        }
        
        // Second pass: Fill remaining slots with highest priority headlines from unused categories
        for (const headline of sortedHeadlines) {
          if (!usedCategories.has(headline.category) && diverseHeadlines.length < 4) {
            diverseHeadlines.push(headline);
            usedCategories.add(headline.category);
          }
          
          if (diverseHeadlines.length >= 4) break;
        }
        
        // If still not enough, add highest priority regardless of category
        if (diverseHeadlines.length < 3) {
          for (const headline of sortedHeadlines) {
            if (!diverseHeadlines.find(h => h.id === headline.id) && diverseHeadlines.length < 4) {
              diverseHeadlines.push(headline);
            }
            if (diverseHeadlines.length >= 4) break;
          }
        }
  
        return diverseHeadlines;
      };
  
      const featuredHeadlines = getSmartFeaturedHeadlines(headlinesToUse);
  
      const generatedNewsletter: NewsletterData = {
        content: newsletterData.choices[0].message.content,
        topHeadlines: featuredHeadlines,
        generatedAt: new Date().toISOString(),
        model: newsletterData.model || 'Perplexity Sonar'
      };
  
      setNewsletter(generatedNewsletter);
  
    } catch (err) {
      console.error('Error generating newsletter:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate newsletter. Please check your API key and try again.';
      setNewsletterError(errorMessage);
    } finally {
      setGeneratingNewsletter(false);
    }
  };

  const handleSummarize = async (id: number) => {
    const headline = headlines.find(h => h.id === id);
    if (!headline) return;

    setSelectedHeadline(headline);
    setSummaryError(null);
    
    if (!headline.summary) {
      setGeneratingId(id);
      
      try {
        const aiResponse = await generateSummaryWithPerplexity(headline);
        
        const summary = aiResponse.choices[0].message.content;
        
        // Handle both new and old citation formats
        let sources: Array<{title: string; url: string; domain: string}> = [];
        
        if (aiResponse.citations && Array.isArray(aiResponse.citations)) {
          // Old format
          sources = aiResponse.citations.map((citation: any) => ({
            title: citation.title || citation.name || 'News Article',
            url: citation.url || '#',
            domain: citation.url ? new URL(citation.url).hostname : 'Unknown Source'
          }));
        } else if (aiResponse.search_results && Array.isArray(aiResponse.search_results)) {
          // New format
          sources = aiResponse.search_results.map((result: any) => ({
            title: result.title || result.name || 'News Article',
            url: result.url || '#',
            domain: result.url ? new URL(result.url).hostname : 'Unknown Source'
          }));
        }

        // Filter out empty or invalid sources
        sources = sources.filter(source => 
          source.url !== '#' && 
          source.domain !== 'Unknown Source' && 
          source.title !== 'News Article'
        );

        const updatedHeadline = {
          ...headline,
          summary: summary,
          summaryMetadata: {
            sources: sources,
            generatedAt: new Date().toISOString(),
            model: aiResponse.model || 'Perplexity Sonar'
          }
        };

        setHeadlines(prev =>
          prev.map(h => h.id === id ? updatedHeadline : h)
        );
        setSelectedHeadline(updatedHeadline);

      } catch (err) {
        console.error('Error generating summary:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to generate AI summary. Please check your API key and try again.';
        setSummaryError(errorMessage);
      } finally {
        setGeneratingId(null);
      }
    }
  };

  const handleNewsletterClick = () => {
    setShowNewsletter(true);
    if (!newsletter) {
      generateNewsletter();
    }
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-container">
          <div className="header-content">
            <div className="logo-section">
              <h1 className="logo">Newslines</h1>
              <span className="tagline">Multi-Source AI News</span>
            </div>
            
            <div className="search-container">
              <div className="search-input-wrapper">
                <Search className="search-icon" />
              </div>
              <input
                type="text"
                className="search-input"
                placeholder="Search headlines..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="header-actions">
              {/* Newsletter Tab */}
              <button 
                onClick={handleNewsletterClick}
                className="newsletter-tab"
              >
                <FileText className="icon-sm" />
                Generate Daily Newsletter
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main">
        {/* Controls Bar */}
        <div className="controls-bar">
          <div className="controls-left">
            <h2 className="main-title">Latest Headlines</h2>
            {lastUpdated && (
              <span className="last-updated">
                Last updated: {lastUpdated}
              </span>
            )}
          </div>
          
          <div className="controls-right">
            {/* Source Filter */}
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="filter-select"
            >
              {sources.map(source => (
                <option key={source} value={source === 'All Sources' ? 'all' : source}>
                  {source}
                </option>
              ))}
            </select>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="filter-select"
            >
              {categories.map(category => (
                <option key={category} value={category === 'All Categories' ? 'all' : category}>
                  {category}
                </option>
              ))}
            </select>
            
            {/* Refresh Button */}
            <button 
              onClick={fetchHeadlines} 
              disabled={loading}
              className="refresh-button"
            >
              <RefreshCw className={`icon-sm ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="warning-banner">
            <div className="warning-header">
              <AlertTriangle className="warning-icon icon-sm" />
              <div className="warning-content">
                <h3>Some sources encountered issues:</h3>
                <ul className="warning-list">
                  {warnings.map((warning, index) => (
                    <li key={index}>• {warning}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="error-banner">
            <p>⚠️ {error}</p>
            <button onClick={fetchHeadlines} className="error-retry">
              Try Again
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="loading-headlines">
            <div className="spinner-large"></div>
            <p>Loading latest headlines from CNN, Fox News, and NBC News</p>
          </div>
        ) : (
          <>
            {/* Results Info */}
            <div className="results-info">
              Showing {filteredHeadlines.length} of {headlines.length} headlines
              {searchTerm && ` matching "${searchTerm}"`}
              {selectedSource !== 'all' && selectedSource !== 'All Sources' && ` from ${selectedSource}`}
              {selectedCategory !== 'all' && selectedCategory !== 'All Categories' && ` in ${selectedCategory}`}
            </div>

            {/* Headlines Grid */}
            <div className="headlines-grid">
              {filteredHeadlines.map((headline) => (
                <HeadlineCard
                  key={headline.id}
                  headline={headline}
                  onSummarize={handleSummarize}
                  isGenerating={generatingId === headline.id}
                />
              ))}
            </div>
          </>
        )}

        {/* Empty State */}
        {!loading && filteredHeadlines.length === 0 && !error && (
          <div className="empty-search">
            <Search className="empty-search-icon" />
            <h3 className="empty-search-title">No headlines found</h3>
            <p className="empty-search-text">Try adjusting your search terms or filters</p>
          </div>
        )}
      </main>

      {/* Summary Modal */}
      <SummaryModal
        headline={selectedHeadline}
        onClose={() => {
          setSelectedHeadline(null);
          setSummaryError(null);
        }}
        isGenerating={generatingId === selectedHeadline?.id}
        error={summaryError}
      />

      {/* Newsletter Modal */}
      {showNewsletter && (
        <NewsletterModal
          newsletter={newsletter}
          onClose={() => {
            setShowNewsletter(false);
            setNewsletterError(null);
          }}
          isGenerating={generatingNewsletter}
          error={newsletterError}
        />
      )}
    </div>
  );
};

export default App;
