# UX Revamp Implementation Plan

## Goal
Maximize user experience by introducing a global notification system (Toasts) and smooth cinematic transitions between workflow steps.

## Proposed Changes

### 1. Global Toast System
Create a robust Toast notification system to replace inline error messages and provide non-intrusive feedback.

#### [NEW] `src/contexts/ToastContext.tsx`
- **ToastProvider**: Context to manage toast state queue.
- **ToastComponent**: UI component using Aceternity-style glassmorphism.
- **Hooks**: `useToast()` for easy dispatching from any component.
- **Animations**: Slide-in/slide-out using framer-motion.

### 2. Smooth Step Transitions
Refactor `page.tsx` to use Framer Motion's `AnimatePresence` for seamless transitions between wizard steps.

#### [MODIFY] `src/app/page.tsx`
- Wrap step content in `<motion.div>` with `initial`, `animate`, `exit` variants.
- Implement "slide left" vs "slide right" depending on navigation direction.
- Replace static error/success divs with `toast.error()` and `toast.success()` calls.

### 3. Stepper Enhancements
#### [MODIFY] `src/components/campaign/Stepper.tsx`
- Add layout animations to the progress bar itself.
- Ensure the active step "glow" animates smoothly to the new position.

### 4. Pixel-Perfect Visual Replication (Endhonesa Style)
Goal: Match `https://campaign.endhonesa.com/` 1:1.

#### [MODIFY] `src/app/page.tsx`
- **Header**: Add "Base Sepolia • AI Agent" subtitle.
- **Hero**:
    - Add "Built for Web3" pill badge.
    - Update title with distinct gradient ("AI-Powered" vs "Campaign Builder").
    - Add 3 Feature Pills below description (`USDC Escrow`, `AI Content`, `On-chain Release`).
- **Layout**:
    - Convert main content to a **2-Column Grid** (Left: Form, Right: Contract Info).
    - Move Contract Info + Action Buttons to the Right Column (sticky if possible).
- **Campaign Form**:
    - Add "Create Campaign" icon header.
    - Use `Textarea` for Objective.
    - Group `Budget` and `Deadline` side-by-side.
- **Footer**:
    - Update copyright/branding to match "Built on Base with AI".

#### [MODIFY] `src/components/ui/Backgrounds.tsx` or `src/app/page.tsx`
- Add ambient radial glows (Spotlights) to corners.
2. **Transition Test**:
   - Click "Create Campaign" -> Verify the current step slides out left and the next step slides in from right.
   - Click back (stepper nav) -> Verify reverse animation direction.
