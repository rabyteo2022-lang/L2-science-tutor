export interface Topic {
  id: string;
  title: string;
  content: string; // Raw text content from the PDF
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface Slide {
  script: string;
  visualDescription: string;
}

export enum ViewState {
  NOTES = 'NOTES',
  VIDEO = 'VIDEO',
  QUIZ = 'QUIZ'
}

export interface GeneratedContentResponse {
  text: string;
}