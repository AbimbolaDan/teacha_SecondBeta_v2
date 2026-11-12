# Project memory

## Product intent & audience

- Educational/study app with study materials and an AI chat assistant named "Wunmi"
- Users read/view materials and can ask Wunmi questions, including from selected text
- Two distinct modes exist: Study Mode and Learning Mode (behaviors diverge)

## Brand personality & voice

- Assistant is personified as "Wunmi"; UI uses conversational phrasing ("Ask Wunmi")

## Visual design & UX direction

- Mobile Study Mode uses a bottom drawer for chat; material remains full-screen and mounted
- Floating "Ask Wunmi" button opens the chat drawer on mobile
- Text-selection flow pre-populates the chat draft and auto-opens the drawer
- Desktop Study Mode and Learning Mode (all breakpoints) use different, unchanged patterns
- Responsive behavior is mode-specific, not global

## Decisions, constraints & rationale

- Replaced mobile Study Mode tab-swap with bottom drawer so material stays mounted and visible while chatting
- Old mobile tab bar removed in Study Mode
- Desktop and Learning Mode intentionally untouched to avoid regression

## Open questions & assumptions

- Exact distinction between Study Mode and Learning Mode not yet detailed
- Wunmi backend/integration specifics unknown
- Tech stack beyond vite-react not specified