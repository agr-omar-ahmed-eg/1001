export interface Question {
  text: string;
  type: 'short_answer' | 'paragraph' | 'multiple_choice' | 'checkbox' | 'dropdown';
  options: string[];
  required: boolean;
}

export interface FormStructure {
  title: string;
  description: string;
  questions: Question[];
}
