import React, { useState, useEffect, useRef } from 'react';
import { generateLessonSlides, generateSlideImage, generateSpeech } from '../services/geminiService';
import { Slide } from '../types';

interface LessonPlayerProps {
  topicTitle: string;
  content: string;
}

const LessonPlayer: React.FC<LessonPlayerProps> = ({ topicTitle, content }) => {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [volume, setVolume] = useState(1.0);

  // Caches
  const imageCache = useRef<Record<number, string>>({});
  const audioCache = useRef<Record<number, AudioBuffer>>({});
  
  // Audio Context Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Initialize Audio Context and Gain Node
  useEffect(() => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass({ sampleRate: 24000 });
    const gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);
    
    audioContextRef.current = ctx;
    gainNodeRef.current = gainNode;

    return () => {
      ctx.close();
    };
  }, []);

  // Update volume
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume;
    }
  }, [volume]);

  // Helper to decode PCM data from Gemini
  const decodeAudioData = async (data: ArrayBuffer): Promise<AudioBuffer> => {
    if (!audioContextRef.current) throw new Error("No Audio Context");
    const ctx = audioContextRef.current;
    
    // Raw PCM 16-bit decoding
    const dataInt16 = new Int16Array(data);
    const numChannels = 1; // Gemini TTS is usually mono
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, 24000); // 24kHz sample rate for this model

    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        // Normalize Int16 to Float32 [-1.0, 1.0]
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  };

  const playAudioBuffer = (buffer: AudioBuffer) => {
    if (!audioContextRef.current || !gainNodeRef.current) return;
    
    // Stop previous
    if (currentSourceRef.current) {
      try { currentSourceRef.current.stop(); } catch (e) { /* ignore */ }
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    // Connect source -> gain -> destination
    source.connect(gainNodeRef.current);
    
    source.onended = () => setIsSpeaking(false);
    
    currentSourceRef.current = source;
    setIsSpeaking(true);
    source.start();
  };

  // Initial Load: Generate Slides structure
  useEffect(() => {
    const initLesson = async () => {
      setLoading(true);
      try {
        // Clear caches when topic changes
        imageCache.current = {};
        audioCache.current = {}; 
        if (currentSourceRef.current) {
            try { currentSourceRef.current.stop(); } catch (e) {}
        }
        
        const generatedSlides = await generateLessonSlides(content);
        setSlides(generatedSlides);
        setCurrentSlideIndex(0);
      } catch (error) {
        console.error("Failed to gen slides", error);
      } finally {
        setLoading(false);
      }
    };
    initLesson();
  }, [content]);

  // Slide Transition Effect
  useEffect(() => {
    if (slides.length === 0) return;

    const loadSlideAssets = async () => {
      const slide = slides[currentSlideIndex];

      // 1. Handle Image
      let imgUrl = imageCache.current[currentSlideIndex];
      if (imgUrl) {
        setCurrentImage(imgUrl);
        setImageLoading(false);
      } else {
        setCurrentImage(null);
        setImageLoading(true);
        try {
          imgUrl = await generateSlideImage(slide.visualDescription);
          imageCache.current[currentSlideIndex] = imgUrl;
          setCurrentImage(imgUrl);
        } catch (e) {
          console.error(e);
        } finally {
          setImageLoading(false);
        }
      }

      // 2. Handle Audio
      let audioBuffer = audioCache.current[currentSlideIndex];
      if (audioBuffer) {
        playAudioBuffer(audioBuffer);
      } else {
        // Stop any playing audio while loading new one
        if (currentSourceRef.current) {
            try { currentSourceRef.current.stop(); } catch (e) {}
            setIsSpeaking(false);
        }
        
        try {
          const audioData = await generateSpeech(slide.script);
          if (audioData) {
            audioBuffer = await decodeAudioData(audioData);
            audioCache.current[currentSlideIndex] = audioBuffer;
            playAudioBuffer(audioBuffer);
          }
        } catch (e) {
          console.error("Audio gen failed", e);
        }
      }
    };

    loadSlideAssets();

    return () => {
      if (currentSourceRef.current) {
        try { currentSourceRef.current.stop(); } catch (e) {}
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSlideIndex, slides]);

  const handleNext = () => {
    if (currentSlideIndex < slides.length - 1) {
      setCurrentSlideIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(prev => prev - 1);
    }
  };

  const handleReplay = () => {
    const audioBuffer = audioCache.current[currentSlideIndex];
    if (audioBuffer) {
      playAudioBuffer(audioBuffer);
    }
  };

  if (loading || slides.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-black text-white rounded-xl">
        <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-b-4 border-blue-500 mb-6"></div>
        <h2 className="text-3xl font-bold tracking-wide">Creating Your Lesson</h2>
        <p className="text-gray-400 mt-3 text-xl">Generating custom teaching script and visuals...</p>
      </div>
    );
  }

  const currentSlide = slides[currentSlideIndex];

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white overflow-hidden rounded-xl shadow-2xl">
      {/* Video Screen Area - Maximized */}
      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden group">
        {currentImage ? (
          <img 
            src={currentImage} 
            alt={currentSlide.visualDescription} 
            className="w-full h-full object-contain animate-fade-in"
          />
        ) : (
          <div className="flex flex-col items-center">
             {imageLoading ? (
               <div className="animate-pulse text-gray-500 text-2xl font-semibold flex flex-col items-center">
                 <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-500 mb-4"></div>
                 Generating Visuals...
               </div>
             ) : (
               <div className="text-gray-600">Image unavailable</div>
             )}
          </div>
        )}
        
        {/* Subtitles Overlay - Adjusted to not block image, smaller font */}
        <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-4 md:p-6 text-center backdrop-blur-sm">
          <p className="text-xl md:text-2xl font-medium text-yellow-300 leading-relaxed font-sans">
            {currentSlide.script}
          </p>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="h-28 bg-gray-800 flex items-center justify-between px-10 border-t border-gray-700 shrink-0">
        <div className="flex flex-col max-w-[30%]">
          <span className="text-base text-gray-400 uppercase tracking-wider font-semibold truncate">{topicTitle}</span>
          <span className="text-2xl font-bold text-white">Slide {currentSlideIndex + 1} <span className="text-gray-500 text-lg">/ {slides.length}</span></span>
        </div>

        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3 bg-gray-900 px-4 py-2 rounded-lg">
            <span className="text-gray-400 text-sm font-bold uppercase">Vol</span>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.1" 
              value={volume} 
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-24 accent-blue-500 h-1 cursor-pointer"
            />
          </div>

          <div className="flex gap-6">
            <button 
              onClick={handlePrev} 
              disabled={currentSlideIndex === 0}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl font-bold text-lg transition-colors"
            >
              Previous
            </button>
            
            <button 
              onClick={handleReplay}
              className={`px-6 py-3 rounded-xl font-bold text-lg flex items-center gap-3 transition-colors shadow-lg ${isSpeaking ? 'bg-blue-600 text-white ring-2 ring-blue-400' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}
            >
              {isSpeaking ? 'Speaking...' : 'Replay'}
            </button>

            <button 
              onClick={handleNext} 
              disabled={currentSlideIndex === slides.length - 1}
              className="px-6 py-3 bg-primary hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl font-bold text-lg transition-colors shadow-lg"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LessonPlayer;