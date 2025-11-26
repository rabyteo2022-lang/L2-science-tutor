import React, { useState } from 'react';
import { HashRouter } from 'react-router-dom';
import { TOPICS } from './constants';
import { Topic, ViewState } from './types';
import NotesView from './components/NotesView';
import QuizView from './components/QuizView';
import LessonPlayer from './components/LessonPlayer';

const App: React.FC = () => {
  const [currentTopic, setCurrentTopic] = useState<Topic>(TOPICS[0]);
  const [viewState, setViewState] = useState<ViewState>(ViewState.VIDEO);

  return (
    <HashRouter>
      <div className="flex h-screen bg-slate-100">
        {/* Sidebar */}
        <aside className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0">
          <div className="p-6 border-b border-slate-100">
            <h1 className="text-2xl font-extrabold text-primary tracking-tight">SciGenius</h1>
            <p className="text-sm text-slate-500 mt-1">L2 Science Tutor</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Chapters</h3>
            {TOPICS.map(topic => (
              <button
                key={topic.id}
                onClick={() => {
                  setCurrentTopic(topic);
                  setViewState(ViewState.VIDEO); // Reset to video on topic change
                }}
                className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 group
                  ${currentTopic.id === topic.id 
                    ? 'bg-blue-50 border-blue-200 shadow-sm ring-1 ring-blue-100' 
                    : 'hover:bg-slate-50 hover:border-slate-200 border border-transparent'
                  }`}
              >
                <div className="flex flex-col items-start">
                  <span className={`text-xs font-bold uppercase tracking-wider mb-1 ${
                    currentTopic.id === topic.id ? 'text-blue-500' : 'text-slate-400 group-hover:text-slate-500'
                  }`}>
                    Topic {topic.id}
                  </span>
                  <span className={`text-sm font-semibold leading-snug ${
                    currentTopic.id === topic.id ? 'text-blue-900' : 'text-slate-700 group-hover:text-slate-900'
                  }`}>
                    {topic.title}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col h-full overflow-hidden relative">
          {/* Top Navigation Bar */}
          <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 z-10 shadow-sm">
            <div className="flex items-center gap-3 overflow-hidden">
              <span className="bg-slate-100 text-slate-500 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider shrink-0">
                Topic {currentTopic.id}
              </span>
              <h2 className="text-xl font-bold text-slate-800 truncate max-w-2xl" title={currentTopic.title}>
                {currentTopic.title}
              </h2>
            </div>
            
            <div className="flex bg-slate-100 p-1 rounded-lg shrink-0">
              <button
                onClick={() => setViewState(ViewState.VIDEO)}
                className={`px-6 py-2 rounded-md text-sm font-semibold transition-all ${
                  viewState === ViewState.VIDEO ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Teaching Video
              </button>
              <button
                onClick={() => setViewState(ViewState.NOTES)}
                className={`px-6 py-2 rounded-md text-sm font-semibold transition-all ${
                  viewState === ViewState.NOTES ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Smart Notes
              </button>
              <button
                onClick={() => setViewState(ViewState.QUIZ)}
                className={`px-6 py-2 rounded-md text-sm font-semibold transition-all ${
                  viewState === ViewState.QUIZ ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Quiz Challenge
              </button>
            </div>
          </header>

          {/* Content Area */}
          <div className="flex-1 p-6 overflow-hidden bg-slate-50">
            <div className="h-full w-full max-w-7xl mx-auto">
              {viewState === ViewState.VIDEO && (
                <LessonPlayer topicTitle={currentTopic.title} content={currentTopic.content} />
              )}
              {viewState === ViewState.NOTES && (
                <NotesView topicId={currentTopic.id} content={currentTopic.content} />
              )}
              {viewState === ViewState.QUIZ && (
                <QuizView content={currentTopic.content} />
              )}
            </div>
          </div>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;