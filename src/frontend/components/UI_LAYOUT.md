# UI Layout Guide

Visual representation of the GameControls and DifficultySlider components.

---

## Control Panel Layout

```
┌─────────────────────────────────────────┐
│         GAME CONTROLS PANEL             │
│  (Background: #16213e, Rounded: 8px)    │
├─────────────────────────────────────────┤
│                                         │
│  ┌───────────────┐  ┌──────────────┐   │
│  │  + New Game   │  │  X  Resign   │   │
│  └───────────────┘  └──────────────┘   │
│                                         │
│  ┌───────────────┐  ┌──────────────┐   │
│  │  ←  Undo      │  │  ⚙  Settings │   │
│  └───────────────┘  └──────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

**Button Grid:** 2x2 grid with 12px gap
**Button Style:**
- Primary: #4a4e69
- Hover: #5c6078 with 2px lift
- New Game: #829769 (accent color)
- Disabled: 40% opacity

---

## New Game Modal

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  (Overlay: rgba(0,0,0,0.7) + blur)             │
│                                                 │
│     ┌────────────────────────────────┐         │
│     │       New Game                 │         │
│     │   Choose your color            │         │
│     ├────────────────────────────────┤         │
│     │                                │         │
│     │  ┌─────┐  ┌─────┐  ┌─────┐   │         │
│     │  │  ♔  │  │  ?  │  │  ♚  │   │         │
│     │  │White│  │Rand.│  │Black│   │         │
│     │  └─────┘  └─────┘  └─────┘   │         │
│     │                                │         │
│     │         ┌──────────┐          │         │
│     │         │  Cancel  │          │         │
│     │         └──────────┘          │         │
│     └────────────────────────────────┘         │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Modal Content:**
- Min width: 400px
- Centered: 50% top/left with translate(-50%, -50%)
- Background: #16213e
- Border radius: 12px
- Shadow: 0 8px 32px rgba(0,0,0,0.5)

**Color Selection:**
- 3-column grid with 16px gap
- Icon font size: 48px
- Hover: Border color #829769 + 4px lift

---

## Settings Panel

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  (Overlay: rgba(0,0,0,0.7) + blur)                 │
│                                                     │
│   ┌──────────────────────────────────────────┐    │
│   │  Settings                            ×   │    │
│   ├──────────────────────────────────────────┤    │
│   │                                          │    │
│   │  ┌────────────────────────────────────┐ │    │
│   │  │ Difficulty              2200       │ │    │
│   │  │                                    │ │    │
│   │  │ 800  ═══════════●═══════════ 3000 │ │    │
│   │  │                                    │ │    │
│   │  │ [Beginner][Casual][Club]          │ │    │
│   │  │ [Advanced][Expert]                │ │    │
│   │  └────────────────────────────────────┘ │    │
│   │                                          │    │
│   │  ┌────────────────────────────────────┐ │    │
│   │  │ ☑ Sound Effects                   │ │    │
│   │  └────────────────────────────────────┘ │    │
│   │                                          │    │
│   │  ┌────────────────────────────────────┐ │    │
│   │  │ ☑ Show Coordinates                │ │    │
│   │  └────────────────────────────────────┘ │    │
│   │                                          │    │
│   └──────────────────────────────────────────┘    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Settings Content:**
- Min width: 500px
- Max width: 600px
- Background: #1a1a2e
- Header border: 1px solid #333

---

## Difficulty Slider Detail

```
┌────────────────────────────────────────┐
│ Difficulty                      1800   │
├────────────────────────────────────────┤
│                                        │
│ 800  ═══════════●════════════  3000   │
│                                        │
├────────────────────────────────────────┤
│ [Beginner] [Casual] [Club]             │
│ [Advanced] [Expert]                    │
└────────────────────────────────────────┘
```

**Components:**
1. Header row: Label + Value display
2. Slider row: Min label + Range input + Max label
3. Presets row: 5 buttons in flex wrap

**Slider Styling:**
- Track height: 6px
- Track color: #333
- Thumb size: 20px diameter
- Thumb color: #829769
- Hover: 1.15x scale

**Preset Buttons:**
- Min width: 70px
- Padding: 8px 12px
- Active state: #829769 background, #1a1a2e text

---

## Responsive Behavior

### Desktop (> 768px)
```
Control Panel: 2x2 grid
Modal: 400px min width
Settings: 500-600px width
Preset buttons: Flex wrap, 5 buttons
```

### Tablet (480px - 768px)
```
Control Panel: 2x2 grid (slightly compressed)
Modal: 90% width, max 400px
Settings: 90% width, max 500px
Preset buttons: 2-3 per row
```

### Mobile (< 480px)
```
Control Panel: 2x2 grid (touch-friendly)
Modal: 95% width
Settings: 95% width
Preset buttons: 2 per row
Slider: Touch-optimized thumb (24px)
```

---

## Color Palette

```
Background Colors:
  Primary:   #1a1a2e  ████████
  Secondary: #16213e  ████████

Button Colors:
  Default:   #4a4e69  ████████
  Hover:     #5c6078  ████████
  Accent:    #829769  ████████

Text Colors:
  Primary:   #eee     ████████
  Secondary: #888     ████████

Special:
  Slider:    #333     ████████
```

---

## Spacing System

```
Gap sizes:
  Small:  8px   (preset button gaps)
  Medium: 12px  (control button gaps)
  Large:  16px  (section margins)
  XLarge: 20px  (panel padding)
  XXLarge: 24px (modal padding)

Border Radius:
  Small:  4px   (preset buttons)
  Medium: 6px   (control buttons)
  Large:  8px   (panels)
  XLarge: 12px  (modals)

Padding:
  Buttons:  8-12px vertical, 12-16px horizontal
  Panels:   16-20px all sides
  Modals:   24-32px all sides
```

---

## Interactive States

### Button States
```
Normal:   [  Button  ]     opacity: 1.0
Hover:    [  Button  ]↑    opacity: 1.0, transform: translateY(-2px)
Active:   [  Button  ]     opacity: 1.0, transform: translateY(0)
Disabled: [  Button  ]     opacity: 0.4, cursor: not-allowed
```

### Slider States
```
Normal:   ═══●═══            thumb: 20px, #829769
Hover:    ═══●═══            thumb: 23px (scale 1.15)
Active:   ═══●═══            thumb: 20px
Focus:    ═══●═══            outline: 2px solid #829769
```

### Modal States
```
Hidden:   display: none
Visible:  display: block, opacity: 1
Entering: fade in 200ms
Exiting:  fade out 200ms
```

---

## Animation Timings

```css
Buttons:     0.2s ease
Modals:      0.3s ease
Hover lift:  0.2s ease
Slider:      0.15s ease
Settings:    0.3s ease-in-out
```

---

## Accessibility

### Keyboard Navigation
- Tab: Move between interactive elements
- Enter/Space: Activate buttons
- Arrow keys: Adjust slider
- Escape: Close modals/settings

### ARIA Labels
- Buttons: Clear labels ("New Game", "Resign", etc.)
- Slider: aria-label="Difficulty level from 800 to 3000 Elo"
- Modal: aria-modal="true", role="dialog"
- Settings: aria-label="Game settings"

### Screen Reader Support
- All interactive elements have accessible names
- State changes announced (game started, difficulty changed)
- Modal focus trap when open
- Settings panel focus trap when open

---

## Touch Targets

All interactive elements meet minimum touch target size:
- Buttons: 44px × 44px minimum
- Slider thumb: 44px × 44px touch area
- Checkboxes: 44px × 44px touch area
- Modal close button: 44px × 44px minimum

---

## Visual Hierarchy

```
Level 1: Panel Backgrounds (#16213e)
  ↓
Level 2: Buttons (#4a4e69)
  ↓
Level 3: Active Elements (#829769)
  ↓
Level 4: Text (#eee)
  ↓
Level 5: Secondary Text (#888)
```
