// Placeholder intake questions. Replace the lorem ipsum text with the real
// questions later. Keep the ordering: short-ended (MCQ) first, then
// non-leading open-ended questions.

const LOREM =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore?'

export const NOT_SURE = "I'm not sure"

export const mcqQuestions = Array.from({ length: 5 }, (_, i) => ({
  id: `mcq-${i + 1}`,
  text: LOREM,
  options: [
    'Lorem ipsum dolor sit amet',
    'Consectetur adipiscing elit',
    'Sed do eiusmod tempor',
    'Ut labore et dolore magna',
  ],
}))

export const openQuestions = Array.from({ length: 5 }, (_, i) => ({
  id: `open-${i + 1}`,
  text: LOREM,
  placeholder: 'Describe in your own words. Stick to what you can show, not what you believe.',
}))
