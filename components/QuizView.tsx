import React, { useState, useEffect } from 'react';
import { generateQuizQuestion } from '../services/geminiService';
import { QuizQuestion } from '../types';

interface QuizViewProps {
  content: string;
}

const TOTAL_QUESTIONS = 5;

const QuizView: React.FC<QuizViewProps> = ({ content }) => {
  const [loading, setLoading] = useState(false);
  const [quizState, setQuizState] = useState<'intro' | 'playing' | 'finished'>('intro');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [quizHistory, setQuizHistory] = useState<string[]>([]);
  
  const [currentQuestionData, setCurrentQuestionData] = useState<QuizQuestion | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  // Start a new quiz session
  const startQuiz = () => {
    setQuizState('playing');
    setCurrentQuestionIndex(0);
    setScore(0);
    setQuizHistory([]);
    loadQuestion([]); 
  };

  const loadQuestion = async (currentHistory: string[], retryQuestion?: string) => {
    setLoading(true);
    setSelectedOption(null);
    setIsCorrect(null);
    try {
      const data = await generateQuizQuestion(content, retryQuestion, currentHistory);
      setCurrentQuestionData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleOptionClick = (option: string) => {
    if (selectedOption) return; // Prevent changing answer
    setSelectedOption(option);
    const correct = option === currentQuestionData?.correctAnswer;
    setIsCorrect(correct);
    if (correct) {
      setScore(prev => prev + 1);
    }
  };

  const handleNext = () => {
    // Add current question context to history so we don't repeat concepts
    const updatedHistory = [...quizHistory, currentQuestionData?.question || ""];
    setQuizHistory(updatedHistory);

    if (currentQuestionIndex < TOTAL_QUESTIONS - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      loadQuestion(updatedHistory);
    } else {
      setQuizState('finished');
    }
  };

  const handleRetrySimilar = () => {
    // Load a similar question without advancing the index or score
    if (currentQuestionData) {
      loadQuestion(quizHistory, currentQuestionData.question);
    }
  };

  if (quizState === 'intro') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="bg-white p-10 rounded-3xl shadow-xl max-w-2xl w-full">
          <h2 className="text-4xl font-extrabold text-primary mb-6">Knowledge Check</h2>
          <p className="text-xl text-slate-600 mb-8">
            Ready to test your understanding? This quiz consists of <span className="font-bold text-slate-800">{TOTAL_QUESTIONS} questions</span> covering different learning outcomes from this chapter.
          </p>
          <div className="flex gap-4 justify-center">
            <div className="bg-blue-50 p-4 rounded-xl">
              <span className="block text-2xl font-bold text-blue-600">Adaptive</span>
              <span className="text-sm text-slate-500">Tailored feedback</span>
            </div>
            <div className="bg-green-50 p-4 rounded-xl">
              <span className="block text-2xl font-bold text-green-600">Detailed</span>
              <span className="text-sm text-slate-500">Explanations provided</span>
            </div>
          </div>
          <button 
            onClick={startQuiz}
            className="mt-10 px-10 py-4 bg-primary text-white text-xl font-bold rounded-xl shadow-lg hover:bg-blue-700 hover:scale-105 transition-all"
          >
            Start Quiz
          </button>
        </div>
      </div>
    );
  }

  if (quizState === 'finished') {
    const percentage = Math.round((score / TOTAL_QUESTIONS) * 100);
    let message = "Keep practicing!";
    if (percentage >= 80) message = "Outstanding work!";
    else if (percentage >= 60) message = "Good effort!";

    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="bg-white p-12 rounded-3xl shadow-xl text-center max-w-lg w-full">
          <h2 className="text-3xl font-bold text-slate-800 mb-2">Quiz Complete!</h2>
          <p className="text-slate-500 mb-8">Here is how you did</p>
          
          <div className="mb-8">
            <div className="text-6xl font-extrabold text-primary mb-2">{score}/{TOTAL_QUESTIONS}</div>
            <div className="text-2xl font-semibold text-slate-700">{percentage}%</div>
          </div>
          
          <div className="bg-slate-50 p-4 rounded-xl mb-8 border border-slate-100">
            <p className="text-lg text-slate-800 font-medium">"{message}"</p>
          </div>

          <button 
            onClick={startQuiz}
            className="w-full px-8 py-3 bg-white border-2 border-primary text-primary font-bold rounded-xl hover:bg-blue-50 transition-colors"
          >
            Retake Quiz
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary"></div>
        <p className="text-xl text-gray-600 font-medium animate-pulse">Generating Question {currentQuestionIndex + 1}...</p>
      </div>
    );
  }

  if (!currentQuestionData) return <div>Error loading quiz.</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 h-full flex flex-col">
      {/* Progress Header */}
      <div className="mb-6">
        <div className="flex justify-between items-end mb-2">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Quiz Session</h2>
          <span className="text-lg font-bold text-primary">Question {currentQuestionIndex + 1} <span className="text-slate-400 text-base">/ {TOTAL_QUESTIONS}</span></span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-3">
          <div 
            className="bg-primary h-3 rounded-full transition-all duration-500 ease-out" 
            style={{ width: `${((currentQuestionIndex + 1) / TOTAL_QUESTIONS) * 100}%` }}
          ></div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-8 leading-relaxed">
            {currentQuestionData.question}
          </h2>

          <div className="space-y-4">
            {currentQuestionData.options.map((option, idx) => (
              <button
                key={idx}
                onClick={() => handleOptionClick(option)}
                disabled={selectedOption !== null}
                className={`w-full p-5 text-left rounded-xl border-2 transition-all duration-200 text-lg relative
                  ${
                    selectedOption === null
                      ? 'border-slate-100 hover:border-blue-300 hover:bg-blue-50 text-slate-700'
                      : option === currentQuestionData.correctAnswer
                      ? 'border-green-500 bg-green-50 text-green-900 font-semibold shadow-sm'
                      : selectedOption === option
                      ? 'border-red-500 bg-red-50 text-red-900 font-medium'
                      : 'border-slate-100 text-slate-400 opacity-60'
                  }
                `}
              >
                <div className="flex items-center">
                  <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border-2 mr-4 text-sm font-bold
                    ${selectedOption === null ? 'border-slate-300 text-slate-400' : 
                      option === currentQuestionData.correctAnswer ? 'border-green-600 bg-green-600 text-white' :
                      selectedOption === option ? 'border-red-500 bg-red-500 text-white' : 'border-slate-200 text-slate-300'}
                  `}>
                    {String.fromCharCode(65 + idx)}
                  </span>
                  {option}
                </div>
              </button>
            ))}
          </div>
        </div>

        {selectedOption && (
          <div className={`p-6 rounded-2xl border ${isCorrect ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'} animate-fade-in-up shadow-sm`}>
            <div className="flex items-start gap-4">
              <div className={`p-2 rounded-full ${isCorrect ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                {isCorrect ? (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                )}
              </div>
              <div>
                <h3 className={`text-lg font-bold mb-2 ${isCorrect ? 'text-green-800' : 'text-red-800'}`}>
                  {isCorrect ? 'That\'s Correct!' : 'Not quite right'}
                </h3>
                <p className="text-slate-700 text-lg leading-relaxed">{currentQuestionData.explanation}</p>
              </div>
            </div>
            
            <div className="mt-8 flex gap-4 justify-end">
              {!isCorrect && (
                <button
                  onClick={handleRetrySimilar}
                  className="px-6 py-3 bg-white text-primary border-2 border-primary rounded-xl font-bold hover:bg-blue-50 transition-colors"
                >
                  Try Similar Question
                </button>
              )}
              <button
                onClick={handleNext}
                className="px-8 py-3 bg-primary text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-md flex items-center gap-2"
              >
                {currentQuestionIndex < TOTAL_QUESTIONS - 1 ? 'Next Question' : 'See Results'}
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizView;