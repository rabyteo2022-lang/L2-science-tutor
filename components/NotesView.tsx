import React, { useEffect, useState } from 'react';
import { generateSummary } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';

interface NotesViewProps {
  topicId: string;
  content: string;
}

const NotesView: React.FC<NotesViewProps> = ({ topicId, content }) => {
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const fetchNotes = async () => {
      setLoading(true);
      try {
        // Simple in-memory cache for session
        const cacheKey = `notes_${topicId}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          setNotes(cached);
        } else {
          const generated = await generateSummary(content);
          setNotes(generated);
          sessionStorage.setItem(cacheKey, generated);
        }
      } catch (error) {
        console.error(error);
        setNotes("Error generating notes. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchNotes();
  }, [topicId, content]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <span className="ml-4 text-lg font-semibold text-gray-600">Generating Study Notes...</span>
      </div>
    );
  }

  return (
    <div className="prose prose-lg max-w-none p-8 bg-white rounded-xl shadow-sm h-full overflow-y-auto">
      <ReactMarkdown>{notes}</ReactMarkdown>
    </div>
  );
};

export default NotesView;